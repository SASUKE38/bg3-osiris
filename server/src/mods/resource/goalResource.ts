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
import { Resource, ResourceKind } from "./resource";
import { Diagnostic, DocumentSymbol, Location, SymbolKind, uinteger, WorkspaceSymbol } from "vscode-languageserver";
import { readFile } from "fs/promises";
import { encodePath } from "../../utils/pathUtils";
import { SemanticTokenOsirisTypes } from "../../components/symbolManager";
import { Signature, SignatureCollection, SignatureType } from "../signature";
import { Mod } from "../mod";
import { readFileSync } from "fs";

export class GoalResource extends Resource {
	private readonly readDatabases = new Set<string>();
	private readonly writtenDatabases = new Set<string>();
	private workspaceSymbols: WorkspaceSymbol[] = [];
	private semanticTokens: uinteger[] = [];
	private signatures = new SignatureCollection();
	private definedSignatures = new Set<string>();
	private calledSignatures = new Set<string>();
	readonly kind: ResourceKind = ResourceKind.Goal;
	protected symbols: DocumentSymbol[] = [];
	protected document: TextDocument;
	parent = "";

	constructor(mod: Mod, name: string, path: string) {
		super(mod, name, path);
		this.document = TextDocument.create(encodePath(path), "osiris", 1, readFileSync(path, { encoding: "utf-8" }));
	}

	async getData(data: "signatures"): Promise<SignatureCollection>;
	async getData(data: "diagnostics"): Promise<Diagnostic[]>;
	async getData(data: "semanticTokens"): Promise<uinteger[]>;
	async getData(data: "workspaceSymbols"): Promise<WorkspaceSymbol[]>;
	async getData(data: "symbols"): Promise<DocumentSymbol[]>;
	async getData(data: "readDatabases" | "writtenDatabases"): Promise<Set<string>>;
	async getData(
		data:
			| "diagnostics"
			| "semanticTokens"
			| "workspaceSymbols"
			| "symbols"
			| "signatures"
			| "readDatabases"
			| "writtenDatabases"
	): Promise<DocumentSymbol[] | WorkspaceSymbol[] | number[] | SignatureCollection | Diagnostic[] | Set<string>> {
		if (!this.isValid()) await this.load();
		return this[data];
	}

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
					: "";
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
		const documentation = await this.mod.manager.server.documentationManager.getDocumentation();
		const inheritedSignatures = this.mod.inheritedSignatures;
		if (!root) return;

		function getSignatures(node: ASTNode, thisArg: GoalResource) {
			for (const child of node.getNodeChildren()) {
				if (!child) continue;
				if (child.kind === ASTNodeKind.RULE_NODE) {
					const rule = child as RuleNode;
					extractCallSignature(rule.call, rule.type, thisArg);
					extractConditionSignatures(
						rule.conditions.filter((value) => value.kind === ASTNodeKind.SIGNATURE_NODE) as SignatureNode[],
						rule.type,
						thisArg
					);
					extractActionSignature(rule.actions, rule.type, thisArg);
				} else if (child.kind === ASTNodeKind.SIGNATURE_SECTION_NODE) {
					const signatures = child as SignatureSectionNode;
					extractSignatureSectionSignatures(signatures.content, thisArg);
				} else {
					getSignatures(child, thisArg);
				}
			}
		}

		function extractSignature(
			signatureNode: SignatureNode,
			section: "call" | "condition" | "action",
			ruleType: "PROC" | "QRY" | "IF" | ""
		): Signature {
			return new Signature(
				signatureNode.name,
				signatureNode.parameters.map((value) => (value.type ? value.type.value : "")),
				getSignatureType(section, ruleType, signatureNode)
			);
		}

		function extractCallSignature(
			signatureNode: SignatureNode,
			ruleType: "PROC" | "QRY" | "IF",
			thisArg: GoalResource
		) {
			const signature = extractSignature(signatureNode, "call", ruleType);

			if (ruleType === "IF" && signature.type === "Database") thisArg.readDatabases.add(signature.name);
			thisArg.signatures.set(signature);
			thisArg.definedSignatures.add(signature.name);
		}

		function extractConditionSignatures(
			signatureNodes: SignatureNode[],
			ruleType: "PROC" | "QRY" | "IF",
			thisArg: GoalResource
		) {
			for (const signatureNode of signatureNodes) {
				const signature = extractSignature(signatureNode, "condition", ruleType);
				if (signature.type === "Database") {
					thisArg.readDatabases.add(signature.name);
					thisArg.signatures.set(signature);
				}
				thisArg.calledSignatures.add(signature.name);
			}
		}

		function extractActionSignature(
			signatureNodes: SignatureNode[],
			ruleType: "PROC" | "QRY" | "IF",
			thisArg: GoalResource
		) {
			for (const signatureNode of signatureNodes) {
				const signature = extractSignature(signatureNode, "action", ruleType);
				if (signature.type === "Database") {
					thisArg.writtenDatabases.add(signature.name);
					thisArg.signatures.set(signature);
				}
				thisArg.calledSignatures.add(signature.name);
			}
		}

		function extractSignatureSectionSignatures(signatureNodes: SignatureNode[], thisArg: GoalResource) {
			for (const signatureNode of signatureNodes) {
				const signature = extractSignature(signatureNode, "call", "");
				if (signature.type !== "Database") return;
				thisArg.writtenDatabases.add(signature.name);
				thisArg.signatures.set(signature);
				thisArg.definedSignatures.add(signature.name);
			}
		}

		function getSignatureType(
			section: "call" | "condition" | "action",
			ruleType: "PROC" | "QRY" | "IF" | "",
			signature: SignatureNode
		): SignatureType {
			if (inheritedSignatures.has(signature)) {
				const inheritedSignature = inheritedSignatures.get(signature);
				if (
					inheritedSignature?.type === "Event" ||
					inheritedSignature?.type === "Call" ||
					inheritedSignature?.type === "Query" ||
					inheritedSignature?.type === "SysCall" ||
					inheritedSignature?.type === "SysQuery"
				)
					return inheritedSignature.type;
			}
			if (section === "call") {
				if (ruleType === "PROC") return "Proc";
				else if (ruleType === "QRY") return "UserQuery";
				else if (ruleType === "IF" || ruleType === "") return "Database";
			} else {
				if (signature.name.startsWith("DB_")) return "Database";
			}
			return "Proc";
		}

		this.readDatabases.clear();
		this.writtenDatabases.clear();
		this.signatures.clear();
		this.calledSignatures.clear();
		this.definedSignatures.clear();
		getSignatures(root, this);
	}
}
