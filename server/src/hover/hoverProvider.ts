import { Connection, Hover, HoverParams, MarkupKind, ServerCapabilities, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";
import { rangeContainsPosition } from "../utils/range/positionUtils";

export class HoverProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onHover(this.handleHover);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			hoverProvider: true
		};
	}

	private handleHover = async (params: HoverParams): Promise<Hover | null> => {
		const { modManager, documentationManager } = this.server;
		const resource = modManager.findResource(decodePath(params.textDocument.uri));
		const symbols = await resource?.getSymbolsAt(params.position);
		if (symbols && symbols.length >= 1) {
			const hoveredSymbol = symbols[symbols.length - 1];
			if (!rangeContainsPosition(hoveredSymbol.selectionRange, params.position)) return null;
			switch (hoveredSymbol.kind) {
				case SymbolKind.Function:
					return {
						contents: {
							kind: MarkupKind.Markdown,
							value: (await documentationManager.getSignatureDocumentation(hoveredSymbol)).join("\n")
						}
					};
					break;
				default:
					break;
			}
		}
		return null;
	};
}
