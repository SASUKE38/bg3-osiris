import { readFileSync, rmSync } from "fs";
import { extractFromPak, extractPathsInPackage, extractStory } from "../utils/edge";
import { FunctionSignature, Story } from "./story";

export class Dependency {
	readonly path;
	readonly ignoredOrphans: string[] = [];
	readonly foundOrphans: string[] = [];
	readonly activeGoals = new Map<number, string>();
	readonly definedSignatures = new Map<string, Map<string, FunctionSignature[]>>();
	story?: Story;

	constructor(path: string) {
		this.path = path;
	}

	async initialize() {
		const goalNames = (await extractPathsInPackage(this.path, "RawFiles")).map((value) =>
			value.substring(0, value.length - 4)
		);
		const osiPath = await extractFromPak(this.path, "story.div.osi");
		if (osiPath === "") return;

		this.story = await extractStory(osiPath);
		rmSync(osiPath);

		for (const node of Object.values(this.story.nodes)) {
			if (!node.ReferencedBy) continue;
			for (const reference of node.ReferencedBy) {
				const goalName = goalNames.find((value) => value === this.story?.goals[reference.GoalRef.Index]?.Name);
				if (!goalName || this.definedSignatures.has(node.Name)) continue;

				this.activeGoals.set(reference.GoalRef.Index, goalName);

				const definitions = this.story.functions.filter((value) => value.Name.Name === node.Name);
				if (!this.definedSignatures.has(goalName)) {
					this.definedSignatures.set(goalName, new Map<string, FunctionSignature[]>());
				}
				const signatureMap = this.definedSignatures.get(goalName) as Map<string, FunctionSignature[]>;

				signatureMap.set(
					node.Name,
					definitions.map((value) => value.Name)
				);
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

		// TODO: Add processing for found orphans
		const foundOrphans = await extractFromPak(this.path, "story_orphanqueries_found.txt");
		if (foundOrphans !== "") {
			rmSync(foundOrphans);
		}
	}
}
