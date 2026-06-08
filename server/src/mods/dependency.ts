import { rmSync } from "fs";
import { extractFromPak, extractPathsInPackage, extractStory } from "../utils/edge";
import { Story } from "./story";

export class Dependency {
	private path;
	private goalNames: string[] = [];
	private story?: Story;

	constructor(path: string) {
		this.path = path;
	}

	async initialize() {
		this.goalNames = await extractPathsInPackage(this.path, "RawFiles");
		const osi = await extractFromPak(this.path, "story.div.osi");
		if (osi === "") {
			console.error(`Dependency ${this.path} missing story file`);
			return;
		}

		this.story = await extractStory(osi);
		rmSync(osi);
	}
}
