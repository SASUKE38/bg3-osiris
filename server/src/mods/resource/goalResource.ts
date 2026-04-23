import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode } from "../../parser/ast/nodes";
import { GoalLexer } from "../../parser/lexer/goalLexer";
import { GoalParser } from "../../parser/parser/goalParser";
import { Resource } from "./resource";
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
			this.ast = new GoalParser(new GoalLexer(this.document).tokenize()).parse();
			return Promise.resolve(this.ast);
		} else {
			// console.error(`Tried loading goal resource ${this.path} without a document.`);
			const content = await readFile(this.path, { encoding: "utf-8" });
			const document = TextDocument.create(this.path, "osiris", 1, content);
			return new GoalParser(new GoalLexer(document).tokenize()).parse();
		}
	}
}
