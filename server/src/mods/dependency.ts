import { readFileSync, rmSync } from "fs";
import { extractFromPak, extractStory } from "../utils/edge";
import { Function, Story } from "./story";
import { DependencyMetaCollectionEntry } from "./mod";

export class Dependency {
	readonly path: string;
	readonly internalPath: string;
	readonly ignoredOrphans: string[] = [];
	readonly foundOrphans: string[] = [];
	readonly activeGoals = new Map<number, string>();
	readonly definedSignatures = new Map<string, Map<string, Function[]>>();
	readonly builtinSignatures = new Map<string, Function[]>();
	goalParents?: Map<string, string>;
	story?: Story;

	constructor(data: DependencyMetaCollectionEntry) {
		this.path = data.path;
		this.internalPath = data.internalPath;
	}

	async initialize() {
		try {
			this.readOrphanFile(`${this.internalPath}/Story/story_orphanqueries_ignore_local.txt`, this.ignoredOrphans);
			this.readOrphanFile(`${this.internalPath}/Story/story_orphanqueries_found.txt`, this.foundOrphans);

			const osiExtractionResult = await extractFromPak(this.path, `${this.internalPath}/Story/story.div.osi`);
			if (osiExtractionResult.OutputPaths) {
				const osiPath = osiExtractionResult.OutputPaths[0];
				await this.initializeWithStory(osiPath);
				rmSync(osiPath);
			} else {
				this.goalParents = new Map<string, string>();
			}
		} catch (error) {
			console.error(`An error occurred while initializing dependency ${this.path}: ${error}`);
		}
	}

	private async readOrphanFile(name: string, orphanCollection: string[]) {
		const extractionResult = await extractFromPak(this.path, name);
		if (!extractionResult.OutputPaths) return;
		const orphanPath = (await extractFromPak(this.path, name)).OutputPaths[0];
		if (!orphanPath) return;

		for (const line of readFileSync(orphanPath, { encoding: "utf-8" }).split(/\r?\n/)) {
			for (const database of line.split(/\s+[0-9]/)) {
				if (database !== "") orphanCollection.push(database);
			}
		}
		rmSync(orphanPath);
	}

	private async initializeWithStory(osiPath: string) {
		this.story = await extractStory(osiPath);
		const goalNames = Object.values(this.story.goals).map((value) => value.Name);

		for (const node of Object.values(this.story.nodes)) {
			if (!node.ReferencedBy) continue;
			for (const reference of node.ReferencedBy) {
				const goalName = goalNames.find((value) => value === this.story?.goals[reference.GoalRef.Index]?.Name);
				if (!goalName || this.definedSignatures.has(node.Name)) continue;

				this.activeGoals.set(reference.GoalRef.Index, goalName);

				const definitions = this.story.functions.filter((value) => value.Name.Name === node.Name);
				if (!this.definedSignatures.has(goalName)) {
					this.definedSignatures.set(goalName, new Map<string, Function[]>());
				}
				const signatureMap = this.definedSignatures.get(goalName) as Map<string, Function[]>;

				signatureMap.set(node.Name, definitions);
			}
		}

		for (const func of this.story.functions.filter(
			(value) =>
				value.Type === "Event" ||
				value.Type === "Call" ||
				value.Type === "Query" ||
				value.Type === "SysCall" ||
				value.Type === "SysQuery"
		)) {
			this.builtinSignatures.set(
				func.Name.Name,
				this.story.functions.filter((value) => value.Name.Name === func.Name.Name)
			);
		}
	}
}
