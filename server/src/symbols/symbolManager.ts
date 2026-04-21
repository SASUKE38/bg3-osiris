import { Connection, DocumentSymbol, DocumentSymbolParams, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { preparePath } from "../utils/path/pathUtils";
import {
	ASTNode,
	ASTNodeKind,
	EnumTypeNode,
	IdentifierNode,
	RuleNode,
	SignatureNode,
} from "../parser/ast/nodes";

/**
 * Server component that manages document symbols.
 */
export class SymbolManager extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDocumentSymbol(this.getDocumentSymbols);
	}

	/**
	 * Parses the AST associated with a given document (if both the document and AST are defined) and returns
	 * its symbols.
	 *
	 * @param document The document whose symbols should be extracted.
	 * @returns A {@link DocumentSymbol} array that contains the given docuemnt's symbols in a hierarchical fashion.
	 */
	private getDocumentSymbols = async (document: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
		const path = preparePath(document.textDocument.uri);
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
	};
}
