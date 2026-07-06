import { readFileSync, rmSync } from "fs";
import { extractFromPak, extractPathsInPackage, extractStory } from "../utils/edge";
import { FunctionSignature, Story } from "./story";
import { DependencyMetaCollectionEntry } from "./mod";

export class Dependency {
	readonly path: string;
	readonly internalPath: string;
	readonly ignoredOrphans: string[] = [];
	readonly foundOrphans: string[] = [];
	readonly activeGoals = new Map<number, string>();
	readonly definedSignatures = new Map<string, Map<string, FunctionSignature[]>>();
	story?: Story;

	constructor(data: DependencyMetaCollectionEntry) {
		this.path = data.path;
		this.internalPath = data.internalPath;
	}

	async initialize() {
		try {
			const goalNames = (await extractPathsInPackage(this.path, this.internalPath + "/Story/RawFiles/Goals")).map(
				(value) => value.substring(0, value.length - 4)
			);
			const osiPath = (await extractFromPak(this.path, this.internalPath + "/Story/story.div.osi"))
				.OutputPaths[0];
			if (!osiPath) return;

			this.story = await extractStory(osiPath);
			rmSync(osiPath);

			this.readOrphanFile("/Story/story_orphanqueries_ignore_local.txt", this.ignoredOrphans);
			this.readOrphanFile("/Story/story_orphanqueries_found.txt", this.foundOrphans);

			for (const node of Object.values(this.story.nodes)) {
				if (!node.ReferencedBy) continue;
				for (const reference of node.ReferencedBy) {
					const goalName = goalNames.find(
						(value) => value === this.story?.goals[reference.GoalRef.Index]?.Name
					);
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
		} catch (error) {
			console.error(`An error occurred while initializing dependency ${this.path}: ${error}`);
		}
	}

	private async readOrphanFile(name: string, orphanCollection: string[]) {
		const orphanPath = (await extractFromPak(this.path, name)).OutputPaths[0];
		if (!orphanPath) return;

		for (const line of readFileSync(orphanPath, { encoding: "utf-8" }).split(/\r?\n/)) {
			for (const database of line.split(/\s+[0-9]/)) {
				if (database !== "") orphanCollection.push(database);
			}
		}
		rmSync(orphanPath);
	}
}
