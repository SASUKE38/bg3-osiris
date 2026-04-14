import { Cheerio, CheerioAPI, load } from "cheerio";
import { ComponentBase } from "../componentBase";
import { Server } from "../server";
import axios from "axios";
import { Element } from "domhandler";
import { writeFile } from 'fs/promises';

// Change to index signatures?
export class DocumentationEntry {
	description: string[] = [];
	fullDefinitions: string[] = [];
	examples: string[] = [];
	seeAlso: string[] = [];

	static readonly fieldMapping = new Map<string, keyof DocumentationEntry>([
		["Description", "description"],
		["Full Definitions", "fullDefinitions"],
		["Example(s)", "examples"],
		["See Also", "seeAlso"]
	]);
}

export class DocumentationProvider extends ComponentBase {
	readonly urlBase = new URL("https://docs.baldursgate3.game");
	readonly urlPathName = "/index.php";
	readonly urlSearchPrefix = "?title=";
	readonly documentationCollection = new Map<string, DocumentationEntry>();

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

	async retrieveCategoryDocumentation(category: string) {
		const url = this.getSearchURL(category);
		const searchURLs: string[] = [];
		const response = await axios.get(url.toString());
		try {
			const $ = load(response.data);
			$(".mw-category-group")
				.children()
				.children()
				.children()
				.each((i, element) => {
					const link = $(element).attr("href");
					if (link) searchURLs.push(link as string);
				});
			await Promise.all(
				searchURLs.map(this.retrieveFunctionDocumentation, this)
			);
			this.logDocumentationCollection();
		} catch {
			console.error("Failed to fetch category documentation.");
		}
	}

	async retrieveFunctionDocumentation(title: string) {
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
			this.parseFunctionDocumentation($content, title, $);
		} catch {
			console.error("Failed to fetch function documentation.");
		}
	}

	private getSearchURL(query: string) {
		const url = new URL(this.urlBase);
		url.search = this.urlSearchPrefix;
		if (query.startsWith(this.urlPathName + this.urlSearchPrefix)) {
			url.search += query.substring(this.urlPathName.length + this.urlSearchPrefix.length);
		} else {
			url.search += query;
		}
		url.pathname = this.urlPathName;
		return url;
	}

	private parseFunctionDocumentation(elements: Cheerio<Element>, title: string, $: CheerioAPI) {
		let header: keyof DocumentationEntry;
		const { fieldMapping } = DocumentationEntry;
		const entry = new DocumentationEntry();
		elements.each((i, el) => {
			const text = $(el).text();
			const field = fieldMapping.get(text);
			if (field) {
				header = field as keyof DocumentationEntry;
			} else {
				if (header) entry[header].push(text);
			}
		});
		this.documentationCollection.set(title, entry);
	}

	private async logDocumentationCollection() {
		try {
			writeFile("builtInDocumentation.json", JSON.stringify(Object.fromEntries(this.documentationCollection), null, 4));
		} catch (error) {
			console.error(error);
		}
	}
}
