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

	async getRootNode(): Promise<ASTNode | undefined> {
		if (this.ast) return Promise.resolve(this.ast);
		else return this.load();
	}
}
