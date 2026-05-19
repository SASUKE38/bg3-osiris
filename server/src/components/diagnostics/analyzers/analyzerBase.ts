import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode } from "../../../parser/ast/nodes";

export abstract class AnalyzerBase {
	document: TextDocument;

	constructor(document: TextDocument) {
		this.document = document;
	}

	abstract analyze(root: ASTNode): Diagnostic[];
}
