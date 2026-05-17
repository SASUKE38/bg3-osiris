import { Connection, Hover, HoverParams, MarkupKind, ServerCapabilities, SymbolKind } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/pathUtils";
import { rangeContainsPosition } from "../utils/positionUtils";

/**
 * Server component that manages hover requests.
 */
export class HoverProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onHover(this.handleHover);
	}

	getCapabilities(): Partial<ServerCapabilities> {
		return {
			hoverProvider: true
		};
	}

	/**
	 * The handler for the Hover request.
	 *
	 * @param params The {@link HoverParams} for this request.
	 * @returns A {@link Hover} instance if the request has a valid position and text document, null otherwise.
	 */
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
