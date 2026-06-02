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
	SignatureSectionNode,
	StringNode
} from "../../parser/ast/nodes";
import { GoalLexer } from "../../parser/lexer/goalLexer";
import { GoalParser } from "../../parser/parser/goalParser";
import { Resource } from "./resource";
import { DocumentSymbol, Location, SymbolKind, uinteger, WorkspaceSymbol } from "vscode-languageserver";
import { readFile } from "fs/promises";
import { encodePath } from "../../utils/pathUtils";
import { SemanticTokenOsirisTypes } from "../../components/symbolManager";
import { Signature } from "../signature";
import { isArrayEqual } from "../../utils/isArrayEqual";

export class GoalResource extends Resource {
	parent = "";

	/**
	 * Parses the {@link document} associated with this resource if it has been loaded
	 * and creates its AST.
	 *
	 * @returns The loaded {@link ASTNode} or `undefined` if {@link document} is `undefined`.
	 */
	async load(): Promise<ASTNode | undefined> {
		function doParse(thisArg: GoalResource, document: TextDocument) {
			const parser = new GoalParser(new GoalLexer(document).tokenize());
			const root = parser.parse();
			thisArg.ast = root;
			thisArg.diagnostics = parser.diagnostics;
			thisArg.parent =
				root.footer?.parentTargetEdge.kind === ASTNodeKind.STRING_NODE
					? (root.footer?.parentTargetEdge as StringNode).value
					: thisArg.parent;
		}

		if (this.document) {
			if (!this.isValid()) {
				doParse(this, this.document);
			}
		} else {
			const content = await readFile(this.path, { encoding: "utf-8" });
			const document = TextDocument.create(this.path, "osiris", 1, content);
			doParse(this, document);
		}
		await Promise.all([this.loadSymbols(), this.loadSignatures()]);
		this.mod.manager.updateSignatures(this.path, this.calledSignatures, this.definedSignatures);
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

	async loadSignatures() {
		const root = this.ast;
		if (!root) return;

		function getSignatures(node: ASTNode, thisArg: GoalResource) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.RULE_NODE) {
					const rule = child as RuleNode;
					extractSignatures([rule.call], thisArg, true, true);
					extractSignatures(rule.conditions, thisArg, false, true);
					extractSignatures(rule.actions, thisArg, false, false);
				} else if (child.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					const signatures = child as SignatureSectionNode;
					extractSignatures(signatures.content, thisArg, false, false);
				} else {
					getSignatures(child, thisArg);
				}
			}
		}

		function extractSignatures(
			signatures: (SignatureNode | ComparisonNode)[],
			thisArg: GoalResource,
			isDefinition = false,
			isRead = false
		) {
			for (let signature of signatures) {
				if (signature.kind !== ASTNodeKind.SIGNATURE_NODE) continue;
				signature = signature as SignatureNode;
				const entry = thisArg.signatures.has(signature.name)
					? thisArg.signatures.get(signature.name)
					: new Signature(signature.name, getSignatureType(signature.name));
				if (entry?.type === "database") {
					if (isRead) entry.isRead = true;
					else entry.isWritten = true;
				} else if (entry) {
					if (isDefinition) entry.isDefined = true;
					else entry.isCalled = true;
				}
				if (isDefinition) {
					const parameterCollection: string[] = [];
					for (const parameter of signature.parameters) {
						const type = parameter.type ? parameter.type.value : "";
						parameterCollection.push(type);
					}
					if (!entry?.parameters.find((value) => isArrayEqual(value, parameterCollection))) {
						entry?.parameters.push(parameterCollection);
					}
				}
				thisArg.signatures.set(signature.name, entry!);

				if (isDefinition) thisArg.definedSignatures.add(signature.name);
				else thisArg.calledSignatures.add(signature.name);
			}
		}

		function getSignatureType(name: string) {
			if (name.startsWith("PROC_")) return "proc";
			else if (name.startsWith("QRY")) return "query";
			else if (name.startsWith("DB_")) return "database";
			else return "builtin";
		}

		this.signatures.clear();
		this.calledSignatures.clear();
		this.definedSignatures.clear();
		getSignatures(root, this);
	}
}
