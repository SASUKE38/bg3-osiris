import { TextDocument } from 'vscode-languageserver-textdocument';
import { Story } from '../story/story';
import { ASTNode } from '../../parser/ast/nodes';

export class Resource {
	private ast?: ASTNode;
	private document?: TextDocument;
	readonly path;
	private readonly story;

	constructor(story: Story, path: string) {
		this.story = story;
		this.path = path;
	}

	async load() {

	}

	setTextDocument(document: TextDocument) {
		this.document = document;
	}

	removeTextDocment() {
		this.document = undefined;
	}
}