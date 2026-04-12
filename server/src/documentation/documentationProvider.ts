import { ComponentBase } from "../componentBase";
import { Server } from '../server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class DocumentationProvider extends ComponentBase {
	readonly urlBase = new URL("https://docs.baldursgate3.game/index.php");
	readonly urlSearchPrefix = "?title=";

	constructor(server: Server) {
		super(server);
	}

	async getFunctionDocumentation(title: string): Promise<string> {
		const url = new URL(this.urlBase);
		url.search = this.urlSearchPrefix + title;
		axios.get(url.toString()).then((response) => {
			const $ = cheerio.load(response.data);
			const $content = $('.mw-body-content')
				.first()
				.children()
				.children()
				.filter((i, element) => {
					return !$(element).hasClass('toc');
				});
			return $content.text();
		}).catch((error) => {
			if (error.response) {
				console.error(`Status ${error.response.status} received for ${url}`);
			} else if (error.request) {
				console.error(`No response for ${url}`);
			} else {
				console.error('Error', error.message);
			}
		});
		return "";
	}
}