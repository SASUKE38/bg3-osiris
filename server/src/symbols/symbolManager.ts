/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	Connection,
	DocumentSymbol,
	DocumentSymbolParams,
	Position,
	PrepareRenameParams,
	Range,
	ReferenceParams,
	SymbolKind,
	TextDocumentIdentifier
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	EnumTypeNode,
	IdentifierNode,
	RuleNode,
	SignatureNode
} from "../parser/ast/nodes";

/**
 * Server component that manages document symbols.
 */
export class SymbolManager extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDocumentSymbol(this.handleDocumentSymbol);
	}

	private handleDocumentSymbol = async (document: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
		return await this.getDocumentSymbols(document.textDocument.uri);
	};

	async getSymbolsAt(documentIdentifier: TextDocumentIdentifier, position: Position): Promise<DocumentSymbol[]> {
		const file = this.server.modManager.findResource(decodePath(documentIdentifier.uri));
		const document = file?.getTextDocument();
		const res: DocumentSymbol[] = [];
		if (!file || !document) return res;
		if (!file.valid) await this.getDocumentSymbols(file.path);

		const positionOffset = document.offsetAt(position);
		function getSymbols(symbols: DocumentSymbol[]) {
			for (const symbol of symbols) {
				const startOffset = document!.offsetAt(symbol.range.start);
				const endOffset = document!.offsetAt(symbol.range.end);
				if (endOffset < positionOffset) continue;
				if (startOffset > positionOffset) break;
				res.push(symbol);
				if (symbol.children) getSymbols(symbol.children);
				break;
			}
		}

		getSymbols(file.symbols);
		return res;
	}

	/**
	 * Parses the AST associated with a given document (if both the document and AST are defined) and returns
	 * its symbols.
	 *
	 * @param document The document whose symbols should be extracted.
	 * @returns A {@link DocumentSymbol} array that contains the given docuemnt's symbols in a hierarchical fashion.
	 */
	private async getDocumentSymbols(document: string): Promise<DocumentSymbol[]> {
		const path = decodePath(document);
		const file = this.server.modManager.findResource(path);
		const root = await file?.getRootNode();
		const res: DocumentSymbol[] = [];
		let hadInit = false;
		if (!root || !file) return res;
		if (file.valid) return file.symbols;

		function getNodeSymbols(node: ASTNode, symbols: DocumentSymbol[]) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind == ASTNodeKind.PARAMETER_NODE) {
					getNodeSymbols(child, symbols);
				} else {
					const symbol: Partial<DocumentSymbol> = {
						children: []
					};
					switch (child.kind) {
						case ASTNodeKind.SIGNATURE_SECTION_NODE:
							symbol.name = hadInit ? "EXIT" : "INIT";
							symbol.kind = SymbolKind.Module;
							hadInit = true;
							getNodeSymbols(child, symbol.children!);
							break;
						case ASTNodeKind.KB_SECTION_NODE:
							symbol.name = "KB";
							symbol.kind = SymbolKind.Module;
							getNodeSymbols(child, symbol.children!);
							break;
						case ASTNodeKind.RULE_NODE:
							symbol.name = (child as RuleNode).type;
							symbol.kind = SymbolKind.Class;
							getNodeSymbols(child, symbol.children!);
							break;
						case ASTNodeKind.SIGNATURE_NODE:
							symbol.name = (child as SignatureNode).name;
							symbol.kind = SymbolKind.Function;
							getNodeSymbols(child, symbol.children!);
							break;
						case ASTNodeKind.COMPARISON_NODE:
							symbol.name = (child as ComparisonNode).operator.value;
							symbol.kind = SymbolKind.Operator;
							getNodeSymbols(child, symbol.children!);
							break;
						case ASTNodeKind.IDENTIFIER_NODE:
							symbol.name = (child as IdentifierNode).value;
							symbol.kind = symbol.name.startsWith("_") ? SymbolKind.Variable : SymbolKind.Constant;
							break;
						case ASTNodeKind.ENUM_TYPE_NODE:
							symbol.name = (child as EnumTypeNode).type;
							symbol.kind = SymbolKind.Enum;
							break;
						default:
							continue;
					}

					symbol.range = child.range;
					symbol.selectionRange = child.selectionRange;
					symbols.push(symbol as DocumentSymbol);
				}
			}
		}
		getNodeSymbols(root, res);
		file.symbols = res;
		return res;
	}

	async getAllSymbols(path: string): Promise<Map<string, DocumentSymbol[]>> {
		const resources = this.server.modManager.getAllResources(path);
		const res = new Map<string, DocumentSymbol[]>();

		for (const resource of resources) {
			res.set(resource.path, await this.getDocumentSymbols(resource.path));
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
		const symbols = await this.getSymbolsAt(params.textDocument, params.position);
		if (symbols.length <= 1) return null;

		const document = this.server.modManager.findResource(decodePath(params.textDocument.uri))?.getTextDocument();
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

		return null;
	}
}
