/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	Connection,
	DocumentSymbol,
	PrepareRenameParams,
	Range,
	RenameParams,
	SymbolKind,
	WorkspaceEdit
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/path/pathUtils";

export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onPrepareRename(this.handlePrepareRename);
		connection.onRenameRequest(this.handleRenameRequest);
	}

	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		return await this.server.symbolManager.validateRenameOrReferences(params);
	};

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit | null> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		if (resource) {
			const symbolsAt = await resource.getSymbolsAt(params.position);
			const oldSymbol = symbolsAt[symbolsAt.length - 1];

			if (oldSymbol.kind === SymbolKind.Variable || oldSymbol.kind === SymbolKind.Constant) {
				return Promise.resolve(this.renameVariableOrConstant(params, symbolsAt, oldSymbol));
			} else if (oldSymbol.kind === SymbolKind.Function) {
				return await this.renameSignature(params, oldSymbol);
			}
		}

		return null;
	};

	private async renameSignature(params: RenameParams, oldSymbol: DocumentSymbol): Promise<WorkspaceEdit> {
		const allSymbols = await this.server.symbolManager.getAllSymbols();
		const res: WorkspaceEdit = { changes: {} };

		for (const entry of allSymbols.entries()) {
			const encodedPath = encodePath(entry[0]);
			res.changes![`${encodedPath}`] = [];
			for (const section of entry[1]) {
				for (const range of this.server.symbolManager.findSignatureUsages(section, oldSymbol)) {
					res.changes![`${encodedPath}`].push({ range: range, newText: params.newName });
				}
			}
		}

		return res;
	}

	private renameVariableOrConstant(
		params: RenameParams,
		symbolsAt: DocumentSymbol[],
		oldSymbol: DocumentSymbol
	): WorkspaceEdit {
		const res: WorkspaceEdit = { changes: { [`${params.textDocument.uri}`]: [] } };

		for (const range of this.server.symbolManager.findVariableOrConstantUses(symbolsAt, oldSymbol)) {
			res.changes![params.textDocument.uri].push({ range: range, newText: params.newName });
		}

		return res;
	}
}
