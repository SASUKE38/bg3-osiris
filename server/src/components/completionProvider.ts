/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	Connection,
	ServerCapabilities
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { ASTNode, ASTNodeKind, IdentifierNode, RuleNode, SignatureNode } from "../parser/ast/nodes";
import { Resource } from "../mods/resource/resource";
import { SignatureCollection } from "../mods/signature";

export class CompletionProvider extends ComponentBase {

	async initializeComponent(connection: Connection): Promise<void> {
		connection.onCompletion(this.handleCompletion);
		connection.onCompletionResolve(this.handleCompletionResolve);
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
		const resource = this.server.modManager.findGoalResource(decodePath(params.textDocument.uri));
		const nodesAt = await resource?.getNodesAt(params.position);
		const signatures = await this.server.modManager.getAllDefinedSignatures();
		let res: CompletionItem[] = [];
		if (!resource || !nodesAt || nodesAt.length === 0) return res;

		const node = nodesAt[nodesAt.length - 1];
		if (node.kind === ASTNodeKind.SIGNATURE_NODE || node.kind === ASTNodeKind.RULE_NODE) {
			// Current node is signature node
			if (nodesAt[0].kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
				// signature in init or exit
				res = [...res, ...(await this.getInitOrExitSignatureCompletions(signatures))];
			} else if (nodesAt[0].kind === ASTNodeKind.KB_SECTION_NODE) {
				// signature in kb
				const prev = nodesAt[nodesAt.length - 2];
				if (prev) {
					res = [...res, ...(await this.getKbSignatureCompletions(prev, params, resource, signatures))];
				}
			}
		} else if (node.kind === ASTNodeKind.PARAMETER_NODE) {
			res = await this.getParameterCompletions(nodesAt, res);
		} else if (node.kind === ASTNodeKind.IDENTIFIER_NODE) {
			// Current node is a parameter
			if ((node as IdentifierNode).value.startsWith("_")) {
				// Current node is a variable
				res = [...res, ...(await this.getVariableCompletions(nodesAt))];
			} else {
				// Current node is a constant
				res = [...res, ...(await this.getConstantCompletions())];
			}
		} else if (node.kind === ASTNodeKind.STRING_NODE) {
			// Current node is a string
			res = [...res, ...(await this.getStringCompletions())];
		} else if (node.kind === ASTNodeKind.ENUM_TYPE_NODE) {
			// Current node is an enum type
		}

		return res;
	};

	private handleCompletionResolve = async (item: CompletionItem): Promise<CompletionItem> => {
		return item;
	};

	private async getVariables(nodesAt: ASTNode[]): Promise<string[]> {
		const res = new Set<string>();

		for (const node of nodesAt) {
			if (node.kind !== ASTNodeKind.RULE_NODE) continue;
			const signatures = [(node as RuleNode).call, ...(node as RuleNode).conditions, ...(node as RuleNode).actions];
			for (const signature of signatures) {
				if (signature.kind !== ASTNodeKind.SIGNATURE_NODE) continue;
				(signature as SignatureNode).parameters.forEach((value) => {
					if (value.content.kind === ASTNodeKind.IDENTIFIER_NODE && (value.content as IdentifierNode).value.startsWith("_") && (value.content as IdentifierNode).value !== "_")
						res.add((value.content as IdentifierNode).value)
				});
			}
		}

		return Array.from(res);
	}

	private async getInitOrExitSignatureCompletions(signatures: SignatureCollection): Promise<CompletionItem[]> {
		return [...signatures.getAllNamesOfType("Database", "Proc", "Call")].map((value) => {
			return {
				label: value,
				kind: CompletionItemKind.Function
			}
		})
	}

	private async getKbSignatureCompletions(
		prev: ASTNode,
		params: CompletionParams,
		resource: Resource,
		signatures: SignatureCollection
	): Promise<CompletionItem[]> {
		const text = resource.getTextDocument()?.getText({ start: prev.range.start, end: params.position });
		let res: CompletionItem[] = [];
		if (text?.match(/(PROC|QRY|IF)\s+.*THEN\s+/s)) {
			// Signature is in action block
			res = [...signatures.getAllNamesOfType("Call", "Proc", "Database")].map((value) => {
				return { label: value, kind: CompletionItemKind.Function}
			});
		} else if (text?.match(/(PROC|QRY|IF)\s+.*AND\s+/s)) {
			// Signature is in condition block
			res = [...signatures.getAllNamesOfType("UserQuery", "SysQuery", "Database")].map((value) => {
				return { label: value, kind: CompletionItemKind.Function}
			});
		} else if (text?.match(/PROC\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, PROC
			res = [...signatures.getAllNamesOfType("Proc")].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/QRY\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, QRY
			res = [...signatures.getAllNamesOfType("UserQuery")].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		} else if (text?.match(/IF\s+[a-zA-Z0-9_-]+/)) {
			// Signature is in call block, IF
			res = [...signatures.getAllNamesOfType("Event", "Query", "UserQuery", "SysQuery", "Database")].map((value) => {
				return { label: value, kind: CompletionItemKind.Function };
			});
		}
		return res;
	}

	private async getVariableCompletions(
		nodesAt: ASTNode[]
	): Promise<CompletionItem[]> {
		return (await this.getVariables(nodesAt)).map((value) => {
				return { label: value, kind: CompletionItemKind.Variable };
			});
	}

	private async getConstantCompletions(): Promise<CompletionItem[]> {
		return Array.from(await this.server.modManager.getAllConstants()).map((value) => {
			return { label: value, kind: CompletionItemKind.Constant };
		})
	}

	private async getStringCompletions(): Promise<CompletionItem[]> {
		return Array.from(await this.server.modManager.getAllStrings()).map((value) => {
			return { label: value, kind: CompletionItemKind.Value };
		})
	}

	private async getParameterCompletions(
		nodesAt: ASTNode[],
		items: CompletionItem[]
	): Promise<CompletionItem[]> {
		return [
			...items,
			...(await this.getConstantCompletions()),
			...(await this.getVariableCompletions(nodesAt))
		];
	}
}
