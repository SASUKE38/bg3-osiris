import { Connection, RenameParams, WorkspaceEdit } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";

export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onRenameRequest(this.handleRenameRequest);
	}

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit> => {
		console.log(await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position));

		return {};
	};
}
