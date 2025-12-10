import { Connection, Diagnostic, DocumentDiagnosticReport, DocumentDiagnosticReportKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { Server } from "../server";
import { TextDocument } from "vscode-languageserver-textdocument";
import { GoalLexer } from "../parser/lexer/goalLexer";
import { GoalParser } from "../parser/parser/goalParser";

export class DiagnosticProvider extends ComponentBase {
	constructor(server: Server) {
		super(server);

		const { documents } = this.server;

		documents.onDidChangeContent((change) => {
			this.validateTextDocument(change.document);
		});
	}

	async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
		const lexer = new GoalLexer(textDocument);
		lexer.tokenize();
		const parser = new GoalParser(lexer.tokens);
		// const node = parser.parse();
		// console.log(node);

		return parser.diagnostics;
	}

	initializeComponent(connection: Connection): void {
		const { documents } = this.server;
		connection.languages.diagnostics.on(async (params) => {
			const document = documents.get(params.textDocument.uri);
			if (document !== undefined) {
				return {
					kind: DocumentDiagnosticReportKind.Full,
					items: await this.validateTextDocument(document)
				} satisfies DocumentDiagnosticReport;
			} else {
				// We don't know the document. We can either try to read it from disk
				// or we don't report problems for it.
				return {
					kind: DocumentDiagnosticReportKind.Full,
					items: []
				} satisfies DocumentDiagnosticReport;
			}
		});
	}
}
