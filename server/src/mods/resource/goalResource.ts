/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TextDocument } from "vscode-languageserver-textdocument";
import {
	ASTNode,
	ASTNodeKind,
	ComparisonNode,
	EnumTypeNode,
	IdentifierNode,
	RuleNode,
	SignatureNode,
	StringNode
} from "../../parser/ast/nodes";
import { GoalLexer } from "../../parser/lexer/goalLexer";
import { GoalParser } from "../../parser/parser/goalParser";
import { Resource } from "./resource";
import { DocumentSymbol, Location, SymbolKind, uinteger, WorkspaceSymbol } from "vscode-languageserver";
import { readFile } from "fs/promises";
import { encodePath } from "../../utils/path/pathUtils";
import { SemanticTokenOsirisTypes } from "../../symbols/symbolManager";

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
		await this.loadSymbols();
		this.validate();
		return Promise.resolve(this.ast);
	}

	async loadSymbols(): Promise<[DocumentSymbol[], WorkspaceSymbol[]]> {
		const root = this.ast;
		const symbols: DocumentSymbol[] = [];
		const workspaceSymbols: WorkspaceSymbol[] = [];
		const semanticTokens: uinteger[] = [];
		const documentation = await this.mod.manager.server.documentationManager.getDocumentation();
		let previousLine = 0;
		let previousStartChar = 0;
		let hadInit = false;
		if (!root) return [symbols, workspaceSymbols];

		function getNodeSymbols(node: ASTNode, symbols: DocumentSymbol[], thisArg: GoalResource) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind == ASTNodeKind.PARAMETER_NODE) {
					getNodeSymbols(child, symbols, thisArg);
				} else {
					const symbol: Partial<DocumentSymbol> = {
						children: []
					};
					switch (child.kind) {
						case ASTNodeKind.SIGNATURE_SECTION_NODE:
							symbol.name = hadInit ? "EXIT" : "INIT";
							symbol.kind = SymbolKind.Module;
							hadInit = true;
							break;
						case ASTNodeKind.KB_SECTION_NODE:
							symbol.name = "KB";
							symbol.kind = SymbolKind.Module;
							break;
						case ASTNodeKind.RULE_NODE:
							symbol.name = (child as RuleNode).type;
							symbol.kind = SymbolKind.Class;
							break;
						case ASTNodeKind.SIGNATURE_NODE:
							symbol.name = (child as SignatureNode).name;
							symbol.kind = SymbolKind.Function;
							if (documentation.has(symbol.name)) {
								const deltaLine = child.range.start.line - previousLine;
								const deltaStartChar =
									previousLine === deltaLine
										? child.range.start.character - previousStartChar
										: child.range.start.character;
								const length =
									child.selectionRange.end.character - child.selectionRange.start.character;
								const type = SemanticTokenOsirisTypes.indexOf(documentation.get(symbol.name)!.type);
								semanticTokens.push(...[deltaLine, deltaStartChar, length, type > 0 ? type : 0, 0]);
								previousLine = child.range.end.line;
								previousStartChar = child.range.end.character;
							}
							break;
						case ASTNodeKind.COMPARISON_NODE:
							symbol.name = (child as ComparisonNode).operator.value;
							symbol.kind = SymbolKind.Operator;
							break;
						case ASTNodeKind.IDENTIFIER_NODE:
							symbol.name = (child as IdentifierNode).value;
							symbol.kind = symbol.name.startsWith("_") ? SymbolKind.Variable : SymbolKind.Constant;
							break;
						case ASTNodeKind.STRING_NODE:
							symbol.name = (child as StringNode).value ? (child as StringNode).value : "empty string";
							symbol.kind = SymbolKind.String;
							break;
						case ASTNodeKind.ENUM_TYPE_NODE:
							symbol.name = (child as EnumTypeNode).type;
							symbol.kind = SymbolKind.Enum;
							break;
						default:
							continue;
					}

					getNodeSymbols(child, symbol.children!, thisArg);
					symbol.range = child.range;
					symbol.selectionRange = child.selectionRange;
					symbols.push(symbol as DocumentSymbol);
					workspaceSymbols.push({
						name: symbol.name,
						kind: symbol.kind,
						location: Location.create(encodePath(thisArg.path), symbol.range)
					});
				}
			}
		}
		getNodeSymbols(root, symbols, this);
		this.symbols = symbols;
		this.workspaceSymbols = workspaceSymbols;
		this.semanticTokens = semanticTokens;
		return [symbols, workspaceSymbols];
	}
}
