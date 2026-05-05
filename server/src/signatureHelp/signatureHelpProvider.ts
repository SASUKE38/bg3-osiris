import { Connection, SignatureHelp, SignatureHelpParams, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";

export class SignatureHelpProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onSignatureHelp(this.handleSignatureHelp);
	}

	private handleSignatureHelp = async (params: SignatureHelpParams): Promise<SignatureHelp | null> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		const symbols = await resource?.getSymbolsAt(params.position);
		if (symbols) {
			const signature = symbols.find((symbol) => symbol.kind === SymbolKind.Function);
		}

		return null;
	};
}
