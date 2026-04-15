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

export class DocumentationProvider extends ComponentBase {
	readonly urlBase = new URL("https://docs.baldursgate3.game");
	readonly urlPathName = "/index.php";
	readonly urlSearchPrefix = "?title=";
	readonly urlPageFromPrefix = "&pagefrom=";
	readonly documentationCollection = new Map<string, DocumentationEntry>();

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

	async getCategories() {
		await this.retrieveCategoryDocumentation(DocumentationProvider.callPages);
		await this.retrieveCategoryDocumentation(DocumentationProvider.eventPages);
		await this.retrieveCategoryDocumentation(DocumentationProvider.queryPages);
	}

	async retrieveCategoryDocumentation(category: [string, string, string][]) {
		await Promise.all(category.map(this.retrieveCategoryPageDocumentation, this));
		this.logDocumentationCollection();
	}

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

	private async logDocumentationCollection() {
		try {
			writeFile(
				DocumentationProvider.collectionPath,
				JSON.stringify(Object.fromEntries(this.documentationCollection), null, 4)
			);
		} catch (error) {
			console.error(error);
		}
	}

	private async readDocumentationCollection() {
		if (existsSync(DocumentationProvider.collectionPath)) {
			const json = await readFile(DocumentationProvider.collectionPath, { encoding: "utf-8" });
			Object.entries(JSON.parse(json)).forEach((entry) => {
				this.documentationCollection.set(entry[0], entry[1] as DocumentationEntry);
			});
		}
	}
}
