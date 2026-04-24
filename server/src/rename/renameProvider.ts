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
import { encodePath } from "../utils/path/pathUtils";

export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onPrepareRename(this.handlePrepareRename);
		connection.onRenameRequest(this.handleRenameRequest);
	}

	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		return await this.server.symbolManager.validateRenameOrReferences(params);
	};

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit> => {
		const symbolsAt = await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position);
		const documentURI = params.textDocument.uri;
		const oldSymbol = symbolsAt[symbolsAt.length - 1];
		const res: WorkspaceEdit = { changes: { [`${documentURI}`]: [] } };

		if (oldSymbol.kind === SymbolKind.Variable || oldSymbol.kind === SymbolKind.Constant) {
			return Promise.resolve(this.renameVariableOrConstant(params, symbolsAt, oldSymbol, documentURI));
		} else if (oldSymbol.kind === SymbolKind.Function) {
			return await this.renameSignature(params, oldSymbol, documentURI);
		}

		return res;
	};

	private async renameSignature(
		params: RenameParams,
		oldSymbol: DocumentSymbol,
		documentURI: string
	): Promise<WorkspaceEdit> {
		const allSymbols = await this.server.symbolManager.getAllSymbols(documentURI);
		const res: WorkspaceEdit = { changes: {} };

		function doRenameTraversal(path: string, symbol: DocumentSymbol) {
			if (!symbol.children) return;
			for (const child of symbol.children) {
				if (child.name === oldSymbol.name) {
					res.changes![`${path}`].push({ range: child.selectionRange, newText: params.newName });
				} else {
					if (child.kind != SymbolKind.Function) {
						doRenameTraversal(path, child);
					}
				}
			}
		}

		for (const entry of allSymbols.entries()) {
			const encodedPath = encodePath(entry[0]);
			res.changes![`${encodedPath}`] = [];
			for (const section of entry[1]) {
				doRenameTraversal(encodedPath, section);
			}
		}

		return res;
	}

	private renameVariableOrConstant(
		params: RenameParams,
		symbolsAt: DocumentSymbol[],
		oldSymbol: DocumentSymbol,
		documentURI: string
	): WorkspaceEdit {
		const res: WorkspaceEdit = { changes: { [`${documentURI}`]: [] } };

		for (let i = symbolsAt.length - 1; i >= 0; i--) {
			if (symbolsAt[i].kind === SymbolKind.Class) {
				if (!symbolsAt[i].children) return {};
				for (const func of symbolsAt[i].children!) {
					if (!func.children) return {};
					for (const parameter of func.children) {
						if (parameter.name === oldSymbol.name) {
							res.changes![`${documentURI}`].push({
								range: parameter.selectionRange,
								newText: params.newName
							});
						}
					}
				}
				break;
			}
		}

		return res;
	}
}
