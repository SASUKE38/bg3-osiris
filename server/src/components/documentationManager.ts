import { ComponentBase } from "../componentBase";
import { join } from "path";
import { ServerCapabilities } from "vscode-languageserver";
import { Signature } from "../mods/signature";
import { existsSync, readFileSync } from "fs";

// Change to index signatures?
export class DocumentationEntry {
	type: string;
	description = "";
	fullDefinitions = "";
	examples = "";
	seeAlso = "";

	static readonly fieldMapping = new Map<string, keyof DocumentationEntry>([
		["Description", "description"],
		["Full Definitions", "fullDefinitions"],
		["Example(s)", "examples"],
		["See Also", "seeAlso"]
	]);

	constructor(type: string) {
		this.type = type;
	}
}

/**
 * Server component that provides mechanisms to store and read Osiris API
 * information from https://docs.baldursgate3.game.
 */
export class DocumentationManager extends ComponentBase {
	private readonly documentationCollection = this.readDocumentationCollection();

	private static readonly collectionPath = join(__dirname, "builtInDocumentation.json");

	getCapabilities(): Partial<ServerCapabilities> {
		return {};
	}

	/**
	 * Retrieves the documentation entry for a given signature.
	 *
	 * @param name The signature name whose entry should be retrieved.
	 * @returns The requested entry or undefined if none could be found.
	 */
	async getDocumentationEntryForSignature(name: string): Promise<DocumentationEntry | undefined> {
		return this.documentationCollection.get(name);
	}

	/**
	 * Loads {@link DocumentationManager.collectionPath} as JSON to {@link documentationCollection}.
	 */
	private readDocumentationCollection() {
		if (!existsSync(DocumentationManager.collectionPath)) return new Map<string, DocumentationEntry>();
		const json = readFileSync(DocumentationManager.collectionPath, { encoding: "utf-8" });
		return new Map<string, DocumentationEntry>(Object.entries(JSON.parse(json)));
	}

	/**
	 * Gets the documentation for a given built-in signature.
	 *
	 * @param symbol The signature to process.
	 * @returns An {@link Array} where each entry is a line of the signature's documentation.
	 */
	async getSignatureDocumentation(signature: Signature): Promise<string[]> {
		const documentationSignature = await this.getDocumentationEntryForSignature(signature.name);
		const label = this.getSignatureLabel(signature, documentationSignature);
		if (!label) return [];
		return ["```osiris", label, "```", ...this.getSignatureDocumentationBody(documentationSignature)];
	}

	/**
	 *
	 * @param entry The entry to process.
	 * @returns An {@link Array} where each entry is a line of the signature's documentation body.
	 */
	getSignatureDocumentationBody(entry?: DocumentationEntry): string[] {
		return [
			...this.getSignatureDescription(entry),
			...this.getSignatureExample(entry),
			...this.getSignatureSeeAlso(entry)
		];
	}

	/**
	 * Gets the label for a signature. That is, gets the type of the signature, the signature name, and the names
	 * of all parameters.
	 *
	 * @param symbol The symbol whose label should be obtained.
	 * @param documentationEntry The entry to search in.
	 * @returns The signature's label.
	 */
	private getSignatureLabel(signature: Signature, documentationEntry?: DocumentationEntry): string | undefined {
		if (documentationEntry) {
			const definitions = this.trimSignatureType(documentationEntry.fullDefinitions.split("\n"));
			const res = definitions.find((definition) => {
				return definition.split(",").length === signature.parameters.length;
			});
			return `${documentationEntry.type} ${res ? res : definitions ? definitions[0] : ""}`;
		} else {
			return undefined;
		}
	}

	/**
	 * Gets all of the possible labels a signature could have as specified by the documentation.
	 *
	 * @param documentationEntry The entry to search in.
	 * @returns An {@link Array} where each entry is a signature label.
	 */
	getAllSignatureLabels(documentationEntry: DocumentationEntry): string[] {
		return this.trimSignatureType(documentationEntry.fullDefinitions.split("\n"))
			.filter((value) => value.length > 0)
			.map((value) => `${documentationEntry.type} ${value}`)
			.sort((a, b) => {
				const aLength = a.split(",");
				const bLength = b.split(",");
				return aLength === bLength ? 0 : aLength < bLength ? -1 : 1;
			});
	}

	/**
	 * Gets the description for a signature.
	 *
	 * @param documentationEntry The entry to search in.
	 * @returns An {@link Array} where each entry is a line of the signature's description.
	 */
	private getSignatureDescription(documentationEntry?: DocumentationEntry): string[] {
		if (documentationEntry?.description) {
			const description = documentationEntry.description.replaceAll("\n", "  ");
			const informationSplit = description.split("Further Information");
			if (informationSplit.length > 1) {
				return ["### Description", informationSplit[0], "  #### Further Information  ", informationSplit[1]];
			}
			return ["### Description", description];
		}
		return [];
	}

	/**
	 * Gets the examples for a signature.
	 *
	 * @param documentationEntry The entry to search in.
	 * @returns An {@link Array} where each entry is a segment of the signature's examples.
	 */
	private getSignatureExample(documentationEntry?: DocumentationEntry): string[] {
		if (documentationEntry?.examples) {
			return ["### Examples", "```osiris", documentationEntry.examples, "```"];
		}
		return [];
	}

	/**
	 * Gets the See Also section for a signature.
	 *
	 * @param documentationEntry The entry to search in.
	 * @returns An {@link Array} where each entry is a segment of the signature's See Also.
	 */
	private getSignatureSeeAlso(documentationEntry?: DocumentationEntry): string[] {
		if (documentationEntry?.seeAlso.length) {
			const list = documentationEntry.seeAlso.split("\n");
			list.forEach((value, index) => {
				list[index] = `- ${value}`;
			});
			return ["### See Also  ", ...list];
		}
		return [];
	}

	/**
	 * Trims call, event, or query from the beginning of a collection of signatures.
	 *
	 * @param signatures The signatures to process.
	 * @returns An {@link Array} of strings were each entry is the original signature but with
	 * the signature type trimmed from the beginning of the signature.
	 */
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
