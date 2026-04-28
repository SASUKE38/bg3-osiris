import { Cheerio, CheerioAPI, load } from "cheerio";
import { ComponentBase } from "../componentBase";
import { Server } from "../server";
import axios from "axios";
import { Element } from "domhandler";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
 * Server component that provides mechanisms to scrape Osiris API
 * information from https://docs.baldursgate3.game.
 */
export class DocumentationManager extends ComponentBase {
	readonly urlBase = new URL("https://docs.baldursgate3.game");
	readonly urlPathName = "/index.php";
	readonly urlSearchPrefix = "?title=";
	readonly urlPageFromPrefix = "&pagefrom=";
	private readonly documentationCollection = new Map<string, DocumentationEntry>();

	private static readonly collectionPath = join(__dirname, "builtInDocumentation.json");

	private static readonly callPages: [string, string, string][] = [
		["Category:Osiris_Calls", "", "call"],
		["Category:Osiris_Calls", "MoveItemTo", "call"],
		["Category:Osiris_Calls", "SetVarInteger", "call"]
	];

	private static readonly eventPages: [string, string, string][] = [
		["Category:Osiris_Events", "", "event"],
		["Category:Osiris_Events", "StartAttack", "event"]
	];

	private static readonly queryPages: [string, string, string][] = [
		["Category:Osiris_Queries", "", "query"],
		["Category:Osiris_Queries", "GetTeleportTarget", "query"]
	];

	constructor(server: Server) {
		super(server);
		axios.interceptors.response.use(
			(response) => {
				return response;
			},
			(error) => {
				console.error(error.message);
				return Promise.reject(error);
			}
		);
	}

	async getDocumentation() {
		if (!existsSync(DocumentationManager.collectionPath)) await this.getCategories();
		await this.readDocumentationCollection();
		return this.documentationCollection;
	}

	/**
	 * Gets and logs Osiris API information for built in calls, events, and queries.
	 */
	async getCategories() {
		await this.retrieveCategoryDocumentation(DocumentationManager.callPages);
		await this.retrieveCategoryDocumentation(DocumentationManager.eventPages);
		await this.retrieveCategoryDocumentation(DocumentationManager.queryPages);
	}

	/**
	 * Scrapes Osiris API information from category pages.
	 *
	 * @param category Array of triples of the form [search, page from, type]
	 * that indicate category page information.
	 */
	async retrieveCategoryDocumentation(category: [string, string, string][]) {
		await Promise.all(category.map(this.retrieveCategoryPageDocumentation, this));
		this.logDocumentationCollection();
	}

	/**
	 * Scrapes Osiris API information from a single category page.
	 *
	 * @param category Triple of the form [search, page from, type]
	 * that indicates category page information.
	 */
	async retrieveCategoryPageDocumentation(category: [string, string, string]) {
		const url = this.getSearchURL(category[0], category[1]);
		const type = category[2];
		const searchURLs: [string, string][] = [];
		const response = await axios.get(url.toString());
		try {
			const $ = load(response.data);
			$(".mw-category-group")
				.children()
				.children()
				.children()
				.each((i, element) => {
					const link = $(element).attr("href");
					if (link) searchURLs.push([link as string, type]);
				});
			await Promise.all(searchURLs.map(this.retrieveFunctionDocumentation, this));
		} catch {
			console.error("Failed to fetch category documentation.");
		}
	}

	/**
	 * Scrapes information for a given Osiris function.
	 *
	 * @param urlPair Pair of the form [name, type] that indicates
	 * information of an Osiris function signature.
	 */
	async retrieveFunctionDocumentation(urlPair: [string, string]) {
		const title = urlPair[0];
		const type = urlPair[1];
		const url = this.getSearchURL(title);
		const response = await axios.get(url.toString());
		try {
			const $ = load(response.data);
			const $content = $(".mw-body-content")
				.first()
				.children()
				.children()
				.filter((_, element) => {
					return !$(element).hasClass("toc");
				});
			const title = $(".mw-page-title-main").text();
			this.parseFunctionDocumentation($content, title, type, $);
		} catch {
			console.error("Failed to fetch function documentation.");
		}
	}

	/**
	 * Gets a properly formatted URL that can be used for scraping Osiris API documentation
	 * information.
	 *
	 * @param query Search query that follows ?title=.
	 * @param pageFrom Function name that follows &pagefrom=.
	 * @returns A properly formatted URL that can be used for scraping with the given parameters.
	 */
	private getSearchURL(query: string, pageFrom = "") {
		const url = new URL(this.urlBase);
		url.search = this.urlSearchPrefix;
		if (query.startsWith(this.urlPathName + this.urlSearchPrefix)) {
			url.search += query.substring(this.urlPathName.length + this.urlSearchPrefix.length);
		} else {
			url.search += query + this.urlPageFromPrefix + pageFrom;
		}
		url.pathname = this.urlPathName;
		return url;
	}

	/**
	 * Parses an Osiris function page scraped from https://docs.baldursgate3.game.
	 * Information is added to {@link documentationCollection} and contains
	 * the sections as described in the field mapping.
	 *
	 * @param elements A Cheerio object to parse.
	 * @param title The name of the Osiris function.
	 * @param type The type of the Osiris function.
	 * @param $ A CheerioAPI initialized to a scraped function page.
	 */
	private parseFunctionDocumentation(elements: Cheerio<Element>, title: string, type: string, $: CheerioAPI) {
		let header: keyof DocumentationEntry;
		const { fieldMapping } = DocumentationEntry;
		const entry = new DocumentationEntry(type);
		elements.each((i, el) => {
			const text = $(el).text();
			const field = fieldMapping.get(text);
			if (field) {
				header = field as keyof DocumentationEntry;
			} else {
				if (header) entry[header] += text;
			}
		});
		this.documentationCollection.set(title, entry);
	}

	/**
	 * Writes {@link documentationCollection} to {@link DocumentationManager.collectionPath} as JSON.
	 */
	private async logDocumentationCollection() {
		try {
			writeFile(
				DocumentationManager.collectionPath,
				JSON.stringify(Object.fromEntries(this.documentationCollection), null, 4)
			);
		} catch (error) {
			console.error(error);
		}
	}

	/**
	 * Loads {@link DocumentationManager.collectionPath} as JSON to {@link documentationCollection}.
	 */
	private async readDocumentationCollection() {
		if (existsSync(DocumentationManager.collectionPath)) {
			const json = await readFile(DocumentationManager.collectionPath, { encoding: "utf-8" });
			Object.entries(JSON.parse(json)).forEach((entry) => {
				this.documentationCollection.set(entry[0], entry[1] as DocumentationEntry);
			});
		}
	}
}
