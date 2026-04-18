import { ASTNode } from "../../parser/ast/nodes";
import { GoalLexer } from "../../parser/lexer/goalLexer";
import { GoalParser } from "../../parser/parser/goalParser";
import { Resource } from "./resource";

export class GoalResource extends Resource {
	async load(): Promise<ASTNode | undefined> {
		if (this.document) {
			this.ast = new GoalParser(new GoalLexer(this.document).tokenize()).parse();
			return this.ast;
		} else {
			console.error(`Tried loading goal resource ${this.path} without a document.`);
		}
		return this.ast;
	}
}
