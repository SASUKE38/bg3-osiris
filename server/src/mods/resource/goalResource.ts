import { TextDocument } from "vscode-languageserver-textdocument";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	EnumTypeNode,
	IdentifierNode,
	RuleNode,
	SignatureNode
} from "../../parser/ast/nodes";
import { GoalLexer } from "../../parser/lexer/goalLexer";
import { GoalParser } from "../../parser/parser/goalParser";
import { Resource } from "./resource";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { readFile } from "fs/promises";

export class GoalResource extends Resource {
	/**
	 * Parses the {@link document} associated with this resource if it has been loaded
	 * and creates its AST.
	 *
	 * @returns The loaded {@link ASTNode} or `undefined` if {@link document} is `undefined`.
	 */
	async load(): Promise<ASTNode | undefined> {
		if (this.document) {
			if (!this.isValid()) {
				this.ast = new GoalParser(new GoalLexer(this.document).tokenize()).parse();
			}
		} else {
			// console.error(`Tried loading goal resource ${this.path} without a document.`);
			const content = await readFile(this.path, { encoding: "utf-8" });
			const document = TextDocument.create(this.path, "osiris", 1, content);
			this.ast = new GoalParser(new GoalLexer(document).tokenize()).parse();
		}
		this.symbols = await this.loadSymbols();
		this.validate();
		return Promise.resolve(this.ast);
	}

	async loadSymbols(): Promise<DocumentSymbol[]> {
		const root = this.ast;
		const res: DocumentSymbol[] = [];
		let hadInit = false;
		if (!root) return res;

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
		return res;
	}
}
