/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Connection, PrepareRenameParams, Range, RenameParams, SymbolKind, WorkspaceEdit } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";

export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onPrepareRename(this.handlePrepareRename);
		connection.onRenameRequest(this.handleRenameRequest);
	}

	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		const symbols = await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position);
		if (symbols.length <= 1) return null;

		const document = this.server.modManager.findResource(decodePath(params.textDocument.uri))?.getTextDocument();
		if (!document) return null;

		const positionOffset = document.offsetAt(params.position);
		const selectionRange = symbols[symbols.length - 1].selectionRange;
		const selectionRangeOffsetStart = document.offsetAt(selectionRange.start);
		const selectionRangeOffsetEnd = document.offsetAt(selectionRange.end);
		if (positionOffset > selectionRangeOffsetEnd || positionOffset < selectionRangeOffsetStart) return null;

		const lastSymbolKind = symbols[symbols.length - 1].kind;
		if (
			lastSymbolKind === SymbolKind.Variable ||
			lastSymbolKind === SymbolKind.Function ||
			lastSymbolKind === SymbolKind.Constant
		) {
			return selectionRange;
		}

		return null;
	};

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit> => {
		const symbolsAt = await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position);
		const documentURI = params.textDocument.uri;
		const oldSymbol = symbolsAt[symbolsAt.length - 1];
		const res: WorkspaceEdit = { changes: { [`${documentURI}`]: [] } };

		if (oldSymbol.kind === SymbolKind.Variable || oldSymbol.kind === SymbolKind.Constant) {
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
		} else if (oldSymbol.kind === SymbolKind.Function) {
			console.log(await this.server.symbolManager.getAllSymbols(documentURI));
		}

		return res;
	};
}
