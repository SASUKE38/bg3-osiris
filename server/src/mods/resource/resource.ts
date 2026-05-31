/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode } from "../../parser/ast/nodes";
import { Diagnostic, DocumentSymbol, Position, uinteger, WorkspaceSymbol } from "vscode-languageserver";
import { readFileSync } from "fs";
import { encodePath } from "../../utils/pathUtils";
import { Signature } from "../signature";
import { Dependency } from '../dependency';

export abstract class Resource {
	readonly path;
	readonly name;
	readonly mod;
	protected ast?: ASTNode;
	protected document: TextDocument;
	protected symbols: DocumentSymbol[] = [];
	protected workspaceSymbols: WorkspaceSymbol[] = [];
	protected semanticTokens: uinteger[] = [];
	protected signatures = new Map<string, Signature>();
	protected definedSignatures = new Set<string>();
	protected calledSignatures = new Set<string>();
	private valid = false;
	diagnostics: Diagnostic[] = [];

	constructor(mod: Dependency, name: string, path: string) {
		this.mod = mod;
		this.name = name;
		this.path = path;

		this.document = TextDocument.create(encodePath(path), "osiris", 1, readFileSync(path, { encoding: "utf-8" }));
	}

	abstract load(): Promise<ASTNode | undefined>;

	abstract loadSymbols(): Promise<[DocumentSymbol[], WorkspaceSymbol[]]>;

	isValid() {
		return this.valid;
	}

	invalidate() {
		this.valid = false;
	}

	validate() {
		this.valid = true;
	}

	/**
	 * Associates a {@link TextDocument} with this Resource.
	 *
	 * @param document The {@link TextDocument} to associate with this Resource.
	 */
	setTextDocument(document: TextDocument) {
		this.document = document;
	}

	getTextDocument() {
		return this.document;
	}

	/**
	 * Retrieves an {@link ASTNode} array that contains all AST nodes asociated with this
	 * {@link Resource} that contain the given position.
	 *
	 * @param position The {@link Position} to search for.
	 * @returns An array of nodes that contain the given {@link Position}.
	 */
	async getNodesAt(position: Position): Promise<ASTNode[]> {
		if (!this.isValid()) await this.load();

		function getNodesIn(node: ASTNode, thisArg: Resource) {
			const children = node.getNodeChildren();
			for (const child of children) {
				if (!child) continue;
				const childStart = thisArg.document!.offsetAt(child.range.start);
				const childEnd = thisArg.document!.offsetAt(child.range.end);
				if (childEnd < offset) continue;
				if (childStart > offset) break;
				res.push(child);
				getNodesIn(child, thisArg);
				break;
			}
		}
		const res: ASTNode[] = [];
		const root = await this.getRootNode();
		if (!root || !this.document) return res;
		const offset = this.document.offsetAt(position);
		getNodesIn(root, this);
		return res;
	}

	/**
	 * Retreives the {@link ASTNode} associated with this {@link Resource}, parsing
	 * the associated document if necessary.
	 *
	 * @returns The root {@link ASTNode} associated with this {@link Resource}.
	 */
	async getRootNode(): Promise<ASTNode | undefined> {
		// if (this.ast) return Promise.resolve(this.ast);
		// else return this.load();
		return await this.load();
	}

	async getData(data: "signatures"): Promise<Map<string, Signature>>;
	async getData(data: "diagnostics"): Promise<Diagnostic[]>;
	async getData(data: "semanticTokens"): Promise<uinteger[]>;
	async getData(data: "workspaceSymbols"): Promise<WorkspaceSymbol[]>;
	async getData(data: "symbols"): Promise<DocumentSymbol[]>;
	async getData(data: "diagnostics" | "semanticTokens" | "workspaceSymbols" | "symbols" | "signatures") {
		if (!this.isValid()) await this.load();
		return this[data];
	}

	async getSymbolsAt(position: Position): Promise<DocumentSymbol[]> {
		const res: DocumentSymbol[] = [];
		if (!this.document) return res;
		if (!this.isValid()) await this.load();

		const positionOffset = this.document.offsetAt(position);

		function getSymbolsIn(symbols: DocumentSymbol[], thisArg: Resource) {
			for (const symbol of symbols) {
				const startOffset = thisArg.document!.offsetAt(symbol.range.start);
				const endOffset = thisArg.document!.offsetAt(symbol.range.end);
				if (endOffset < positionOffset) continue;
				if (startOffset > positionOffset) break;
				res.push(symbol);
				if (symbol.children) getSymbolsIn(symbol.children, thisArg);
				break;
			}
		}

		getSymbolsIn(this.symbols, this);
		return res;
	}
}
