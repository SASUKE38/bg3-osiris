import { Connection, DocumentSymbol } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";

export class SymbolManager extends ComponentBase {
	symbols: DocumentSymbol[] = [];

	initializeComponent(connection: Connection): void {
		connection.onDocumentSymbol(() => {
			return this.symbols;
		});
	}
}
