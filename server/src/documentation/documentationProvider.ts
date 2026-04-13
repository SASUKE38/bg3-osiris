import { ComponentBase } from "../componentBase";
import { Server } from '../server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class DocumentationProvider extends ComponentBase {
	readonly urlBase = new URL("https://docs.baldursgate3.game");
	readonly urlPathName = "/index.php";
	readonly urlSearchPrefix = "?title=";

	constructor(server: Server) {
		super(server);

		axios.interceptors.response.use((response) => {
			return response;
		}, (error) => {
			console.error(error.message);
			return Promise.reject(error);
		});
	}

	async getCategoryLinks(title: string) {
		const url = this.getSearchURL(title);
		const searchURLs: string[] = [];
		axios.get(url.toString()).then(async (response) => {
			const $ = cheerio.load(response.data);
			$('.mw-category-group').children().children().children().each((i, element) => {
				const link = $(element).attr("href");
				if (link) searchURLs.push(link as string);
			})
			await Promise.all(searchURLs.map(async (url) => { this.getFunctionDocumentation(url) }))
		})
	}

	async getFunctionDocumentation(title: string): Promise<string> {
		const url = this.getSearchURL(title);
		axios.get(url.toString()).then((response) => {
			const $ = cheerio.load(response.data);
			const $content = $('.mw-body-content')
				.first()
				.children()
				.children()
				.filter((_, element) => {
					return !$(element).hasClass('toc');
				});
			return $content.text();
		}).catch((error) => {
			console.error("Failed to fetch documentation.")
		});
		return "";
	}

	private getSearchURL(query: string) {
		const url = new URL(this.urlBase);
		if (query.startsWith(this.urlPathName + this.urlSearchPrefix)) {
			url.search = this.urlSearchPrefix + query.substring(this.urlPathName.length + this.urlSearchPrefix.length);
		} else {
			url.search = this.urlSearchPrefix + query;
		}
		url.pathname = this.urlPathName;
		return url;
	}
}