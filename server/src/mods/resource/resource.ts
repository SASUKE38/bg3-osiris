import { TextDocument } from "vscode-languageserver-textdocument";
import { Story } from "../story/story";
import { ASTNode } from "../../parser/ast/nodes";
import { Position } from "vscode-languageserver";

export abstract class Resource {
	readonly path;
	protected ast?: ASTNode;
	protected document?: TextDocument;
	protected readonly story;

	constructor(story: Story, path: string) {
		this.story = story;
		this.path = path;
	}

	abstract load(): Promise<ASTNode | undefined>;

	setTextDocument(document: TextDocument) {
		this.document = document;
	}

	removeTextDocment() {
		this.document = undefined;
	}

	getNodeAt(position: Position) {}

	async getRootNode(): Promise<ASTNode | undefined> {
		if (this.ast) return Promise.resolve(this.ast);
		else return this.load();
	}
}
