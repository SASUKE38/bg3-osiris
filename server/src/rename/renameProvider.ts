/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	Connection,
	DocumentSymbol,
	PrepareRenameParams,
	Range,
	RenameParams,
	ServerCapabilities,
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

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			renameProvider: {
				prepareProvider: true
			}
		};
	}

	private handlePrepareRename = async (params: PrepareRenameParams): Promise<Range | null> => {
		return await this.server.symbolManager.validateRenameOrReferences(params);
	};

	private handleRenameRequest = async (params: RenameParams): Promise<WorkspaceEdit | null> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		if (resource) {
			const symbolsAt = await resource.getSymbolsAt(params.position);
			const oldSymbol = symbolsAt[symbolsAt.length - 1];

			if (oldSymbol.kind === SymbolKind.Variable) {
				return Promise.resolve(this.renameVariableOrKBConstant(params, symbolsAt, oldSymbol));
			} else if (oldSymbol.kind === SymbolKind.Constant) {
				return Promise.resolve(this.renameDeclarationConstant(params, symbolsAt, oldSymbol));
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
				for (const range of this.server.symbolManager.findNestedUses(section, oldSymbol)) {
					res.changes![`${encodedPath}`].push({ range: range, newText: params.newName });
				}
			}
		}

		return res;
	}

	private renameVariableOrKBConstant(
		params: RenameParams,
		symbolsAt: DocumentSymbol[],
		oldSymbol: DocumentSymbol
	): WorkspaceEdit {
		const res: WorkspaceEdit = { changes: { [`${params.textDocument.uri}`]: [] } };

		for (const range of this.server.symbolManager.findVariableUses(symbolsAt, oldSymbol)) {
			res.changes![params.textDocument.uri].push({ range: range, newText: params.newName });
		}

		return res;
	}

	private renameDeclarationConstant(
		params: RenameParams,
		symbolsAt: DocumentSymbol[],
		oldSymbol: DocumentSymbol
	): WorkspaceEdit | null {
		if (
			symbolsAt.length > 0 &&
			(symbolsAt[0].name === "INIT" || symbolsAt[0].name === "EXIT") &&
			symbolsAt[0].kind === SymbolKind.Module
		) {
			const root = symbolsAt.find((symbol) => symbol.kind === SymbolKind.Function);
			if (root) {
				const res: WorkspaceEdit = { changes: { [`${params.textDocument.uri}`]: [] } };
				for (const range of this.server.symbolManager.findNestedUses(root, oldSymbol)) {
					res.changes![params.textDocument.uri].push({ range: range, newText: params.newName });
				}
				return res;
			}
		} else {
			return this.renameVariableOrKBConstant(params, symbolsAt, oldSymbol);
		}

		return null;
	}
}
