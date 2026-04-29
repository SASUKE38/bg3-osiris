import { Connection, DocumentHighlight, DocumentHighlightParams, DocumentSymbol, Location, ReferenceParams, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/path/pathUtils";
import { Resource } from '../mods/resource/resource';

export class ReferencesProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onReferences(this.handleReferences);
		connection.onDocumentHighlight(this.handleDocumentHighlight)
	}

	private handleReferences = async (params: ReferenceParams): Promise<Location[] | null> => {
		if (await this.server.symbolManager.validateRenameOrReferences(params)) {
			const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
			if (resource) {
				const symbolsAt = await resource.getSymbolsAt(params.position);
				const searchSymbol = symbolsAt[symbolsAt.length - 1];

				if (searchSymbol.kind === SymbolKind.Variable || searchSymbol.kind === SymbolKind.Constant) {
					return Promise.resolve(this.findVariableOrConstantReferences(params.textDocument.uri, symbolsAt, searchSymbol));
				} else if (searchSymbol.kind === SymbolKind.Function) {
					return await this.findSignatureReferences(searchSymbol);
				}
			}
		}

		return null;
	};

	private handleDocumentHighlight = async (params: DocumentHighlightParams): Promise<DocumentHighlight[] | null> => {
		if (await this.server.symbolManager.validateRenameOrReferences(params)) {
			const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
			if (resource) {
				const symbolsAt = await resource.getSymbolsAt(params.position);
				const searchSymbol = symbolsAt[symbolsAt.length - 1];

				if (searchSymbol.kind === SymbolKind.Variable || searchSymbol.kind === SymbolKind.Constant) {
					return Promise.resolve(this.findVariableOrConstantHighlights(params.textDocument.uri, symbolsAt, searchSymbol));
				} else if (searchSymbol.kind === SymbolKind.Function) {
					return await this.findSignatureHighlights(resource, searchSymbol);
				}
			}
		}

		return null;
	}

	private findVariableOrConstantReferences(
		document: string,
		symbolsAt: DocumentSymbol[],
		searchSymbol: DocumentSymbol
	): Location[] {
		const res: Location[] = [];

		for (const range of this.server.symbolManager.findVariableOrConstantUses(symbolsAt, searchSymbol)) {
			res.push(Location.create(document, range));
		}

		return res;
	}

	private findVariableOrConstantHighlights(document: string, symbolsAt: DocumentSymbol[], searchSymbol: DocumentSymbol): DocumentHighlight[] {
		const res: DocumentHighlight[] = [];

		for (const range of this.server.symbolManager.findVariableOrConstantUses(symbolsAt, searchSymbol)) {
			res.push({range: range});
		}

		return res;
	}

	private async findSignatureReferences(searchSymbol: DocumentSymbol): Promise<Location[]> {
		const res: Location[] = [];
		const allSymbols = await this.server.symbolManager.getAllSymbols();

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

	private async findSignatureHighlights(resource: Resource, searchSymbol: DocumentSymbol): Promise<DocumentHighlight[]> {
		let res: DocumentHighlight[] = [];

		for (const section of await resource.getSymbols()) {
			for (const range of this.server.symbolManager.findSignatureUsages(section, searchSymbol)) {
				res.push({range: range});
			}
		}

		return res;
	}
}
