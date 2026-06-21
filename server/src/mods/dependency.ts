import { readFileSync, rmSync } from "fs";
import { extractFromPak, extractPathsInPackage, extractStory } from "../utils/edge";
import { FunctionSignature, Story } from "./story";

export class Dependency {
	private path;
	goalNames: string[] = [];
	ignoredOrphans: string[] = [];
	definedSignatures = new Map<string, FunctionSignature[]>();
	story?: Story;

	constructor(path: string) {
		this.path = path;
	}

	async initialize() {
		this.goalNames = (await extractPathsInPackage(this.path, "RawFiles")).map((value) =>
			value.substring(0, value.length - 4)
		);
		const osiPath = await extractFromPak(this.path, "story.div.osi");
		if (osiPath === "") {
			console.error(`Dependency ${this.path} missing story file`);
			return;
		}

		this.story = await extractStory(osiPath);
		for (const node of Object.values(this.story.nodes)) {
			if (!node.ReferencedBy) continue;
			for (const reference of node.ReferencedBy) {
				if (this.goalNames.find((value) => value === this.story?.goals[reference.GoalRef.Index]?.Name)) {
					if (this.definedSignatures.has(node.Name)) {
						continue;
					} else {
						const definitions = this.story.functions.filter((value) => value.Name.Name === node.Name);
						this.definedSignatures.set(
							node.Name,
							definitions.map((value) => value.Name)
						);
					}
				}
			}
		}

		const ignoredOrphansPath = await extractFromPak(this.path, "story_orphanqueries_ignore_local.txt");
		if (ignoredOrphansPath !== "") {
			for (const line of readFileSync(ignoredOrphansPath, { encoding: "utf-8" }).split(/\r?\n/)) {
				for (const database of line.split(/\s+[0-9]/)) {
					if (database !== "") this.ignoredOrphans.push(database);
				}
			}
			rmSync(ignoredOrphansPath);
		}
		rmSync(osiPath);
	}
}
