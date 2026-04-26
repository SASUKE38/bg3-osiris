import { Connection, DocumentSymbol, Location, ReferenceParams, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/path/pathUtils";

export class ReferencesProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onReferences(this.handleReferences);
	}

	private handleReferences = async (params: ReferenceParams): Promise<Location[] | null> => {
		if (await this.server.symbolManager.validateRenameOrReferences(params)) {
			const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
			if (resource) {
				const symbolsAt = await resource.getSymbolsAt(params.position);
				const searchSymbol = symbolsAt[symbolsAt.length - 1];

				if (searchSymbol.kind === SymbolKind.Variable || searchSymbol.kind === SymbolKind.Constant) {
					return Promise.resolve(this.findVariableOrConstantReferences(params, symbolsAt, searchSymbol));
				} else if (searchSymbol.kind === SymbolKind.Function) {
					return await this.findSignatureReferences(params, searchSymbol);
				}
			}
		}

		return null;
	};

	private findVariableOrConstantReferences(
		params: ReferenceParams,
		symbolsAt: DocumentSymbol[],
		searchSymbol: DocumentSymbol
	): Location[] {
		const res: Location[] = [];

		for (const range of this.server.symbolManager.findVariableOrConstantUses(symbolsAt, searchSymbol)) {
			res.push(Location.create(params.textDocument.uri, range));
		}

		return res;
	}

	private async findSignatureReferences(params: ReferenceParams, searchSymbol: DocumentSymbol): Promise<Location[]> {
		const res: Location[] = [];
		const allSymbols = await this.server.symbolManager.getAllSymbols(params.textDocument.uri);

		for (const entry of allSymbols.entries()) {
			const encodedPath = encodePath(entry[0]);
			for (const section of entry[1]) {
				for (const range of this.server.symbolManager.findSignatureUsages(section, searchSymbol)) {
					res.push(Location.create(encodedPath, range));
				}
			}
		}

		return res;
	}
}
