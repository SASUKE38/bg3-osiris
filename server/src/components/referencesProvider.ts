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
import { decodePath, encodePath } from "../utils/pathUtils";
import { Resource } from "../mods/resource/resource";

/**
 * Server component that handles References and Document Highlight requests.
 */
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

	/**
	 * The handler for the References request.
	 *
	 * @param params The {@link ReferenceParams} for the request.
	 * @returns An {@link Array} of {@link Location} instances if references can be found for the given parameters,
	 * null otherwise.
	 */
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

	/**
	 * The handler for the Document Highlight request.
	 *
	 * @param params The {@link DocumentHighlightParams} for this request.
	 * @returns An {@link Array} of {@link DocumentHighlight} instances if document highlights can be calculated
	 * for this request, null otherwise.
	 */
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

	/**
	 * Finds all variable references in a given collection of symbols.
	 *
	 * @param document The uri of the document to search in.
	 * @param symbolsAt The symbols to search in.
	 * @param searchSymbol The symbol to search for.
	 * @returns An {@link Array} of {@link Location} instances where the search symbol is found.
	 */
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

	/**
	 * Finds all ranges to highlight for a given variable.
	 *
	 * @param symbolsAt The symbols to search in.
	 * @param searchSymbol The symbol to search for.
	 * @returns An {@link Array} of {@link Range} instances where the search symbol is found.
	 */
	private findVariableHighlights(symbolsAt: DocumentSymbol[], searchSymbol: DocumentSymbol): DocumentHighlight[] {
		const res: DocumentHighlight[] = [];

		for (const range of this.server.symbolManager.findVariableUses(symbolsAt, searchSymbol)) {
			res.push({ range: range });
		}

		return res;
	}

	/**
	 * Finds all function or constant references for a given symbol in the mod.
	 *
	 * @param searchSymbol The symbol to search for.
	 * @returns An {@link Array} of {@link Location} instances where the search symbol is found.
	 */
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

	/**
	 * Finds all ranges to highlight for a given function or constant.
	 *
	 * @param resource The resource to search in.
	 * @param searchSymbol The symbol to search for.
	 * @returns An {@link Array} of {@link DocumentHighlight} instances of where the search symbol was found.
	 */
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
