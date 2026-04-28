/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	Connection,
	DocumentSymbol,
	DocumentSymbolParams,
	PrepareRenameParams,
	Range,
	ReferenceParams,
	SemanticTokens,
	SemanticTokensParams,
	SymbolKind,
	WorkspaceSymbol
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";

export const SemanticTokenOsirisTypes = ["call", "event", "query", "function", "enum", "enumMember"];

/**
 * Server component that manages document symbols.
 */
export class SymbolManager extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDocumentSymbol(this.handleDocumentSymbol);
		connection.onWorkspaceSymbol(this.handleWorkspaceSymbol);
		connection.languages.semanticTokens.on(this.handleSemanticTokens);
	}

	private handleDocumentSymbol = async (document: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
		const resource = this.server.modManager.findResource(decodePath(document.textDocument.uri));
		if (!resource) return Promise.resolve([]);
		return await resource.getSymbols();
	};

	private handleWorkspaceSymbol = async (): Promise<WorkspaceSymbol[]> => {
		let res: WorkspaceSymbol[] = [];
		for (const resource of this.server.modManager.getAllResources()) {
			res = [...res, ...(await resource.getWorkspaceSymbols())];
		}
		return res;
	};

	private handleSemanticTokens = async(params: SemanticTokensParams): Promise<SemanticTokens> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		if (!resource) return { data: [] };
		return { data: await resource.getSemanticTokens() };
	}

	async getAllSymbols(): Promise<Map<string, DocumentSymbol[]>> {
		const resources = this.server.modManager.getAllResources();
		const res = new Map<string, DocumentSymbol[]>();

		for (const resource of resources) {
			res.set(resource.path, await resource.getSymbols());
		}

		return res;
	}

	findVariableOrConstantUses(symbolsAt: DocumentSymbol[], searchSymbol: DocumentSymbol): Range[] {
		const res: Range[] = [];

		for (let i = symbolsAt.length - 1; i >= 0; i--) {
			if (symbolsAt[i].kind === SymbolKind.Class) {
				if (!symbolsAt[i].children) return [];
				for (const func of symbolsAt[i].children!) {
					if (!func.children) return [];
					for (const parameter of func.children) {
						if (parameter.name === searchSymbol.name) {
							res.push(parameter.selectionRange);
						}
					}
				}
				break;
			}
		}

		return res;
	}

	findSignatureUsages(rootSymbol: DocumentSymbol, searchSymbol: DocumentSymbol): Range[] {
		const res: Range[] = [];

		function doTraversal(symbol: DocumentSymbol) {
			if (!symbol.children) return;
			for (const child of symbol.children) {
				if (child.name === searchSymbol.name) {
					res.push(child.selectionRange);
				} else {
					if (child.kind != SymbolKind.Function) {
						doTraversal(child);
					}
				}
			}
		}

		doTraversal(rootSymbol);
		return res;
	}

	async validateRenameOrReferences(params: PrepareRenameParams | ReferenceParams): Promise<Range | null> {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		if (resource) {
			const symbols = await resource.getSymbolsAt(params.position);
			if (symbols.length <= 1) return null;

			const document = this.server.modManager
				.findResource(decodePath(params.textDocument.uri))
				?.getTextDocument();
			if (!document) return null;

			const positionOffset = document.offsetAt(params.position);
			const selectionRange = symbols[symbols.length - 1].selectionRange;
			const selectionRangeOffsetStart = document.offsetAt(selectionRange.start);
			const selectionRangeOffsetEnd = document.offsetAt(selectionRange.end);
			if (positionOffset > selectionRangeOffsetEnd || positionOffset < selectionRangeOffsetStart) return null;

			const lastSymbolKind = symbols[symbols.length - 1].kind;
			if (
				lastSymbolKind === SymbolKind.Variable ||
				lastSymbolKind === SymbolKind.Function ||
				lastSymbolKind === SymbolKind.Constant
			) {
				return selectionRange;
			}
		}

		return null;
	}
}
