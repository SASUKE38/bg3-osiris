import { Connection, Position, PrepareRenameParams, Range, RenameParams, ResponseError, SymbolKind, WorkspaceEdit } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { preparePath } from '../utils/path/pathUtils';

export class RenameProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onPrepareRename(this.handlePrepareRename);
		connection.onRenameRequest(this.handleRenameRequest);
	}

	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		const symbols = await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position);
		if (symbols.length <= 1) return null;

		const document = this.server.modManager.findResource(preparePath(params.textDocument.uri))?.getTextDocument();
		if (!document) return null;

		const positionOffset = document.offsetAt(params.position);
		const selectionRange = symbols[symbols.length - 1].selectionRange;
		const selectionRangeOffsetStart = document.offsetAt(selectionRange.start);
		const selectionRangeOffsetEnd = document.offsetAt(selectionRange.end);
		if (positionOffset > selectionRangeOffsetEnd || positionOffset < selectionRangeOffsetStart) return null;
		
		if (symbols[symbols.length - 1].kind == SymbolKind.Variable || symbols[symbols.length - 1].kind == SymbolKind.Function) {
			return selectionRange;
		}

		return null;
	}

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit> => {
		console.log(await this.server.symbolManager.getSymbolsAt(params.textDocument, params.position));

		return {};
	};
}
