/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TextDocument } from "vscode-languageserver-textdocument";
import { Story } from "../story/story";
import { ASTNode } from "../../parser/ast/nodes";
import { DocumentSymbol, Position } from "vscode-languageserver";

export abstract class Resource {
	readonly path;
	readonly story;
	protected ast?: ASTNode;
	protected document?: TextDocument;

	symbols: DocumentSymbol[] = [];
	valid = false;

	constructor(story: Story, path: string) {
		this.story = story;
		this.path = path;
	}

	abstract load(): Promise<ASTNode | undefined>;

	/**
	 * Associates a {@link TextDocument} with this Resource.
	 *
	 * @param document The {@link TextDocument} to associate with this Resource.
	 */
	setTextDocument(document: TextDocument) {
		this.document = document;
	}

	/**
	 * Removes the {@link TextDocument} assiocated with this resource.
	 */
	removeTextDocment() {
		this.document = undefined;
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
}
