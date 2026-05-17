/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	Connection,
	DocumentSymbol,
	ServerCapabilities,
	SymbolKind
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { ASTNode, ASTNodeKind, IdentifierNode } from "../parser/ast/nodes";
import { DocumentationEntry } from "./documentationManager";
import { Resource } from "../mods/resource/resource";

export class CompletionProvider extends ComponentBase {
	private documentationCollection?: Map<string, DocumentationEntry>;

	async initializeComponent(connection: Connection): Promise<void> {
		connection.onCompletion(this.handleCompletion);
		connection.onCompletionResolve(this.handleCompletionResolve);

		this.documentationCollection = await this.server.documentationManager.getDocumentation();
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return { completionProvider: { resolveProvider: true, triggerCharacters: ['"'] } };
	}

	/*
	No autocomplete for comments

	TODO: Fix parsing for last node of kb section
	TODO: Fix manual triggering

	*For INIT and EXIT: Add DBs
	*FOR KB: Add PROC, QRY, IF
	*For PROC call: Add PROC_
	*For QRY call: Add QRY_
	*For IF call: Add DB_ and builtin events and queries
	*For conditions: Add QRY_, DB_, builtin queries, constants, and (if in KB) variables
	*For actions: Add PROC_, DB_, and builtin calls
	*For signatures and comparisons: Add types, constants, and (if in KB) variables
	*For strings: Add strings
	For type enums: Add enum members
	*/
	private handleCompletion = async (params: CompletionParams): Promise<CompletionItem[]> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		const nodesAt = await resource?.getNodesAt(params.position);
		let res: CompletionItem[] = [];
		if (resource && nodesAt && nodesAt.length > 0) {
			const node = nodesAt[nodesAt.length - 1];
			if (node.kind === ASTNodeKind.SIGNATURE_NODE || node.kind === ASTNodeKind.RULE_NODE) {
				// Current node is signature node
				if (nodesAt[0].kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					// signature in init or exit
					res = [...res, ...(await this.getInitOrExitSignatureCompletions())];
				} else if (nodesAt[0].kind === ASTNodeKind.KB_SECTION_NODE) {
					// signature in kb
					const prev = nodesAt[nodesAt.length - 2];
					if (prev) {
						res = [...res, ...(await this.getKbSignatureCompletions(prev, params, resource))];
					}
				}
			} else if (node.kind === ASTNodeKind.PARAMETER_NODE) {
				res = await this.getParameterCompletions(resource, params, res);
			} else if (node.kind === ASTNodeKind.IDENTIFIER_NODE) {
				// Current node is a parameter
				if ((node as IdentifierNode).value.startsWith("_")) {
					// Current node is a variable
					res = await this.getVariableCompletions(resource, params, res);
				} else {
					// Current node is a constant
					res = await this.getConstantCompletions(res);
				}
			} else if (node.kind === ASTNodeKind.STRING_NODE) {
				// Current node is a string
				res = await this.getStringCompletions(res);
			} else if (node.kind === ASTNodeKind.ENUM_TYPE_NODE) {
				// Current node is an enum type
			}
		}
		return res;
	};

	private handleCompletionResolve = async (item: CompletionItem): Promise<CompletionItem> => {
		return item;
	};

	private filterDocumentation(...types: ("call" | "event" | "query")[]): string[] {
		const res: string[] = [];

		if (this.documentationCollection) {
			for (const value of this.documentationCollection) {
				if (types.find((type) => type === value[1].type)) {
					res.push(value[0]);
				}
			}
		}

		return res;
	}

	private async filterSymbols(predicate: (value: DocumentSymbol) => boolean): Promise<string[]> {
		const res = new Set<string>();
		const symbols = await this.server.symbolManager.getAllSymbols();

		function doFilter(symbol: DocumentSymbol) {
			if (!symbol.children) return;
			for (const child of symbol.children) {
				if (predicate(child)) res.add(child.name);
				doFilter(child);
			}
		}

		for (const entry of symbols) {
			for (const symbol of entry[1]) {
				doFilter(symbol);
			}
		}

		return Array.from(res);
	}

	private async getVariables(resource: Resource, params: CompletionParams): Promise<string[]> {
		const symbolsAt = await resource.getSymbolsAt(params.position);
		const res = new Set<string>();

		for (let i = symbolsAt.length - 1; i >= 0; i--) {
			if (symbolsAt[i].kind === SymbolKind.Class) {
				if (!symbolsAt[i].children) return [];
				for (const func of symbolsAt[i].children!) {
					if (!func.children) return [];
					for (const parameter of func.children) {
						res.add(parameter.name);
					}
				}
				break;
			}
		}

		return Array.from(res);
	}

	private async getInitOrExitSignatureCompletions(): Promise<CompletionItem[]> {
		return (
			await this.filterSymbols((value) => value.name.startsWith("DB_") && value.kind === SymbolKind.Function)
		).map((value) => {
			return { label: value, kind: CompletionItemKind.Function };
		});
	}

	private async getKbSignatureCompletions(
		prev: ASTNode,
		params: CompletionParams,
		resource: Resource
	): Promise<CompletionItem[]> {
		const text = resource.getTextDocument()?.getText({ start: prev.range.start, end: params.position });
		let res: CompletionItem[] = [];
		if (text?.match(/(PROC|QRY|IF)\s+.*THEN\s+/s)) {
			// Signature is in action block
			res = [
				...this.filterDocumentation("call"),
				...(await this.filterSymbols(
					(value) =>
						value.name.startsWith("PROC_") ||
						(value.name.startsWith("DB_") && value.kind === SymbolKind.Function)
				))
			].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/(PROC|QRY|IF)\s+.*AND\s+/s)) {
			// Signature is in condition block
			res = [
				...this.filterDocumentation("query"),
				...(await this.filterSymbols(
					(value) =>
						value.name.startsWith("QRY_") ||
						(value.name.startsWith("DB_") && value.kind === SymbolKind.Function)
				))
			].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/PROC\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, PROC
			res = (
				await this.filterSymbols(
					(value) => value.name.startsWith("PROC_") && value.kind === SymbolKind.Function
				)
			).map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/QRY\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, QRY
			res = (
				await this.filterSymbols((value) => value.name.startsWith("QRY_") && value.kind === SymbolKind.Function)
			).map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/IF\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, IF
			res = [
				...this.filterDocumentation("event", "query"),
				...(await this.filterSymbols(
					(value) =>
						value.name.startsWith("QRY_") ||
						(value.name.startsWith("DB_") && value.kind === SymbolKind.Function)
				))
			].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		}
		return res;
	}

	private async getVariableCompletions(
		resource: Resource,
		params: CompletionParams,
		items: CompletionItem[]
	): Promise<CompletionItem[]> {
		return [
			...items,
			...(await this.getVariables(resource, params)).map((value) => {
				return { label: value, kind: CompletionItemKind.Variable };
			})
		];
	}

	private async getConstantCompletions(items: CompletionItem[]): Promise<CompletionItem[]> {
		return [
			...items,
			...(await this.filterSymbols((value) => value.kind === SymbolKind.Constant)).map((value) => {
				return { label: value, kind: CompletionItemKind.Variable };
			})
		];
	}

	private async getStringCompletions(items: CompletionItem[]): Promise<CompletionItem[]> {
		return [
			...items,
			...(await this.filterSymbols((value) => value.kind === SymbolKind.String)).map((value) => {
				return { label: value, kind: CompletionItemKind.Value };
			})
		];
	}

	private async getParameterCompletions(
		resource: Resource,
		params: CompletionParams,
		items: CompletionItem[]
	): Promise<CompletionItem[]> {
		return [
			...items,
			...(await this.getConstantCompletions(items)),
			...(await this.getVariableCompletions(resource, params, items))
		];
	}
}
