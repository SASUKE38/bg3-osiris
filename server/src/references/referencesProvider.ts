import {
	Connection,
	DocumentHighlight,
	DocumentHighlightParams,
	DocumentSymbol,
	Location,
	ReferenceParams,
	ServerCapabilities,
	SymbolKind
} from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/path/pathUtils";
import { Resource } from "../mods/resource/resource";

export class ReferencesProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onReferences(this.handleReferences);
		connection.onDocumentHighlight(this.handleDocumentHighlight);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			referencesProvider: true,
			documentHighlightProvider: true
		};
	}

	private handleReferences = async (params: ReferenceParams): Promise<Location[] | null> => {
		if (await this.server.symbolManager.validateRenameOrReferences(params)) {
			const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
			if (resource) {
				const symbolsAt = await resource.getSymbolsAt(params.position);
				const searchSymbol = symbolsAt[symbolsAt.length - 1];

				if (searchSymbol.kind === SymbolKind.Variable) {
					return Promise.resolve(
						this.findVariableReferences(params.textDocument.uri, symbolsAt, searchSymbol)
					);
				} else if (searchSymbol.kind === SymbolKind.Function || SymbolKind.Constant) {
					return await this.findNestedReferences(searchSymbol);
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

				if (searchSymbol.kind === SymbolKind.Variable) {
					return Promise.resolve(this.findVariableHighlights(symbolsAt, searchSymbol));
				} else if (searchSymbol.kind === SymbolKind.Function || searchSymbol.kind === SymbolKind.Constant) {
					return await this.findNestedHighlights(resource, searchSymbol);
				}
			}
		}

		return null;
	};

	private findVariableReferences(
		document: string,
		symbolsAt: DocumentSymbol[],
		searchSymbol: DocumentSymbol
	): Location[] {
		const res: Location[] = [];

		for (const range of this.server.symbolManager.findVariableUses(symbolsAt, searchSymbol)) {
			res.push(Location.create(document, range));
		}

		return res;
	}

	private findVariableHighlights(symbolsAt: DocumentSymbol[], searchSymbol: DocumentSymbol): DocumentHighlight[] {
		const res: DocumentHighlight[] = [];

		for (const range of this.server.symbolManager.findVariableUses(symbolsAt, searchSymbol)) {
			res.push({ range: range });
		}

		return res;
	}

	private async findNestedReferences(searchSymbol: DocumentSymbol): Promise<Location[]> {
		const res: Location[] = [];
		const allSymbols = await this.server.symbolManager.getAllSymbols();

		for (const entry of allSymbols.entries()) {
			const encodedPath = encodePath(entry[0]);
			for (const section of entry[1]) {
				for (const range of this.server.symbolManager.findNestedUses(section, searchSymbol)) {
					res.push(Location.create(encodedPath, range));
				}
			}
		}

		return res;
	}

	private async findNestedHighlights(resource: Resource, searchSymbol: DocumentSymbol): Promise<DocumentHighlight[]> {
		const res: DocumentHighlight[] = [];

		for (const section of await resource.getSymbols()) {
			for (const range of this.server.symbolManager.findNestedUses(section, searchSymbol)) {
				res.push({ range: range });
			}
		}

		return res;
	}
}
