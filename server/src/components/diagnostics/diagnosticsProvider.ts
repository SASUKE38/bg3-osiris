import { Connection, ServerCapabilities, TextDocumentChangeEvent } from "vscode-languageserver";
import { ComponentBase } from "../../componentBase";
import { TextDocument } from "vscode-languageserver-textdocument";
import { decodePath } from "../../utils/pathUtils";

export class DiagnosticProvider extends ComponentBase {
	connection?: Connection;

	getCapabilities(): Partial<ServerCapabilities> {
		return {};
	}

	async validateTextDocument(textDocument: TextDocument) {
		const resource = this.server.modManager.findResource(decodePath(textDocument.uri));
		if (resource) {
			await this.connection?.sendDiagnostics({
				uri: textDocument.uri,
				diagnostics: await resource.getDiagnostics()
			});
		}
	}

	initializeComponent(connection: Connection): void {
		this.connection = connection;
		const { documents } = this.server;
		documents.onDidOpen(this.handleDidOpen);
		documents.onDidChangeContent(this.handleDidChangeContent);
	}

	handleDidOpen = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.server.modManager.findResource(decodePath(event.document.uri));
		if (file) {
			if (event.document.version >= file.getTextDocument().version) {
				file.setTextDocument(event.document);
			}
			this.handleDiagnostics(event);
		}
	};

	handleDidChangeContent = async (event: TextDocumentChangeEvent<TextDocument>) => {
		const file = this.server.modManager.findResource(decodePath(event.document.uri));
		if (file) {
			file.setTextDocument(event.document);
			file.invalidate();
			this.handleDiagnostics(event);
		}
	};

	handleDiagnostics(event: TextDocumentChangeEvent<TextDocument>) {
		this.validateTextDocument(event.document);
	}
}
