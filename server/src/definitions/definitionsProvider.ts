import { Connection, DefinitionParams, DocumentSymbol, Location, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath, encodePath } from "../utils/path/pathUtils";

export class DefinitionsProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onDefinition(this.handleDefinition);
		connection.onImplementation(this.handleDefinition);
	}

	private handleDefinition = async (params: DefinitionParams): Promise<Location[] | null> => {
		const resource = this.server.modManager.findResource(decodePath(params.textDocument.uri));
		if (resource) {
			const symbolsAt = await resource.getSymbolsAt(params.position);
			const searchSymbol = symbolsAt[symbolsAt.length - 1];
			if (searchSymbol.kind === SymbolKind.Variable) {
				return this.getVariableDefinition(params.textDocument.uri, symbolsAt, searchSymbol);
			} else if (
				searchSymbol.kind === SymbolKind.Function &&
				!searchSymbol.name.startsWith("DB_") &&
				!(await this.server.documentationManager.getDocumentation()).has(searchSymbol.name)
			) {
				return await this.getSignatureDefinitions(searchSymbol);
			}
		}

		return null;
	};

	private getVariableDefinition(
		document: string,
		symbolsAt: DocumentSymbol[],
		searchSymbol: DocumentSymbol
	): Location[] | null {
		const uses = this.server.symbolManager.findVariableUses(symbolsAt, searchSymbol);
		return uses.length > 0 ? [Location.create(document, uses[0])] : null;
	}

	private async getSignatureDefinitions(searchSymbol: DocumentSymbol): Promise<Location[]> {
		const symbols = await this.server.symbolManager.getAllSymbols();
		const res: Location[] = [];
		for (const entry of symbols.entries()) {
			if (entry[1].length != 3) continue;
			const rules = entry[1][1].children;
			if (!rules) continue;
			for (const rule of rules) {
				if (!rule.children) continue;
				const nameSymbol = rule.children[0];
				if (nameSymbol.name === searchSymbol.name) {
					res.push(Location.create(encodePath(entry[0]), nameSymbol.selectionRange));
				}
			}
		}

		return res;
	}
}
