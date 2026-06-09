import { readFileSync, rmSync } from "fs";
import { extractFromPak, extractPathsInPackage, extractStory } from "../utils/edge";
import { Story } from "./story";

export class Dependency {
	private path;
	private goalNames: string[] = [];
	private ignoredOrphans: string[] = [];
	private story?: Story;

	constructor(path: string) {
		this.path = path;
	}

	async initialize() {
		this.goalNames = await extractPathsInPackage(this.path, "RawFiles");
		const osiPath = await extractFromPak(this.path, "story.div.osi");
		if (osiPath === "") {
			console.error(`Dependency ${this.path} missing story file`);
			return;
		}

		this.story = await extractStory(osiPath);
		const ignoredOrphansPath = await extractFromPak(this.path, "story_orphanqueries_ignore_local.txt");
		if (ignoredOrphansPath !== "") {
			for (const line of readFileSync(ignoredOrphansPath, { encoding: "utf-8" }).split(/\r?\n/)) {
				for (const database of line.split(/\s+[0-9]/)) {
					if (database !== "") this.ignoredOrphans.push(database);
				}
			}
			rmSync(ignoredOrphansPath);
			console.log(this.ignoredOrphans);
		}
		rmSync(osiPath);
	}
}
