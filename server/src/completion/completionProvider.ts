import { CompletionItem, CompletionParams, Connection, ServerCapabilities } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";

export class CompletionProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onCompletion(this.handleCompletion);
		connection.onCompletionResolve(this.handleCompletionResolve);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return { completionProvider: { resolveProvider: true } };
	}

	/*
	No autocomplete for comments

	For INIT and EXIT: Add DBs
	FOR KB: Add PROC, QRY, IF
	For PROC call: Add PROC_
	For QRY call: Add QRY_
	For IF call: Add DB_ and builtin events and queries
	For conditions: Add QRY_, DB_, builtin queries, constants, and (if in KB) variables
	For actions: Add PROC_, DB_, and builtin calls
	For signatures and comparisons: Add types, constants, strings, and (if in KB) variables
	*/
	private handleCompletion = async (params: CompletionParams): Promise<CompletionItem[]> => {
		return [];
	};

	private handleCompletionResolve = async (item: CompletionItem): Promise<CompletionItem> => {
		return item;
	};
}
