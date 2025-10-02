import { Connection, Diagnostic, DiagnosticSeverity, DocumentDiagnosticReport, DocumentDiagnosticReportKind } from 'vscode-languageserver';
import { ComponentBase } from '../ComponentBase';
import { Server } from '../server';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class DiagnosticProvider extends ComponentBase {

	constructor(server: Server) {
		super(server);

		const {documents} = this.server;

		documents.onDidChangeContent(change => {
			this.validateTextDocument(change.document);
		});
	}

	async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
		const {hasDiagnosticRelatedInformationCapability} = this.server;

		// In this simple example we get the settings for every validate run.
		const settings = await this.server.getDocumentSettings(textDocument.uri);

		// The validator creates diagnostics for all uppercase words length 2 and more
		const text = textDocument.getText();
		const pattern = /\b[A-Z]{2,}\b/g;
		let m: RegExpExecArray | null;

		let problems = 0;
		const diagnostics: Diagnostic[] = [];
		while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
			problems++;
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `${m[0]} is all uppercase.`,
				source: 'ex'
			};
			if (hasDiagnosticRelatedInformationCapability) {
				diagnostic.relatedInformation = [
					{
						location: {
							uri: textDocument.uri,
							range: Object.assign({}, diagnostic.range)
						},
						message: 'Spelling matters'
					},
					{
						location: {
							uri: textDocument.uri,
							range: Object.assign({}, diagnostic.range)
						},
						message: 'Particularly for names'
					}
				];
			}
			diagnostics.push(diagnostic);
		}
		return diagnostics;
	}

	initialize(connection: Connection): void {
		const {documents} = this.server;
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