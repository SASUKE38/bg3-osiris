import { Connection, Hover, HoverParams, MarkupKind, SymbolKind, DocumentSymbol } from "vscode-languageserver";
import { ComponentBase } from "../componentBase";
import { decodePath } from "../utils/path/pathUtils";
import { DocumentationEntry } from "../documentation/documentationManager";

export class HoverProvider extends ComponentBase {
	initializeComponent(connection: Connection): void {
		connection.onHover(this.handleHover);
	}

	private handleHover = async (params: HoverParams): Promise<Hover | null> => {
		const { modManager, documentationManager } = this.server;
		const resource = modManager.findResource(decodePath(params.textDocument.uri));
		const symbols = await resource?.getSymbolsAt(params.position);
		if (symbols) {
			const hoveredSymbol = symbols[symbols.length - 1];
			switch (hoveredSymbol.kind) {
				case SymbolKind.Function:
					{
						const documentationSignature = await documentationManager.getDocumentationForFunction(
							hoveredSymbol.name
						);
						return {
							contents: {
								kind: MarkupKind.Markdown,
								value: [
									"```osiris",
									`${this.getSignatureHover(hoveredSymbol, documentationSignature)}`,
									"```",
									...this.getSignatureDescription(documentationSignature),
									...this.getSignatureExample(documentationSignature),
									...this.getSignatureSeeAlso(documentationSignature)
								].join("\n")
							}
						};
					}
					break;
				default:
					break;
			}
		}
		return null;
	};

	private getSignatureHover(symbol: DocumentSymbol, documentationEntry?: DocumentationEntry): string {
		if (documentationEntry) {
			const definitionString = documentationEntry.fullDefinitions;
			const definitions = this.trimSignatureType(definitionString.split("\n"));
			const res = definitions.find((definition) => {
				return definition.split(",").length === symbol.children?.length;
			});
			return `${documentationEntry.type} ${res ? res : definitions ? definitions[0] : ""}`;
		} else {
			return symbol.name;
		}
	}

	private getSignatureDescription(documentationEntry?: DocumentationEntry): string[] {
		if (documentationEntry?.description) {
			const description = documentationEntry.description.replaceAll("\n", "  ");
			const informationSplit = description.split("Further Information");
			if (informationSplit.length > 1) {
				return [informationSplit[0], "  #### Further Information  ", informationSplit[1]];
			}
			return ["### Description", description];
		}
		return [];
	}

	private getSignatureExample(documentationEntry?: DocumentationEntry) {
		if (documentationEntry?.examples) {
			return ["### Examples", "```osiris", documentationEntry.examples, "```"];
		}
		return [];
	}

	private getSignatureSeeAlso(documentationEntry?: DocumentationEntry) {
		if (documentationEntry?.seeAlso.length) {
			const list = documentationEntry.seeAlso.split("\n");
			list.forEach((value, index) => {
				list[index] = `- ${value}`;
			});
			return ["### See Also  ", ...list];
		}
		return [];
	}

	private trimSignatureType(signatures: string[]): string[] {
		signatures.forEach((value, index) => {
			if (value.startsWith("call ")) {
				signatures[index] = value.substring(5);
			} else if (value.startsWith("event ") || value.startsWith("query ")) {
				signatures[index] = value.substring(6);
			}
		});
		return signatures;
	}
}
