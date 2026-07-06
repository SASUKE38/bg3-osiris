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
	goalParents?: Map<string, string>;
	story?: Story;

	constructor(data: DependencyMetaCollectionEntry) {
		this.path = data.path;
		this.internalPath = data.internalPath;
	}

	async initialize() {
		try {
			this.readOrphanFile("/Story/story_orphanqueries_ignore_local.txt", this.ignoredOrphans);
			this.readOrphanFile("/Story/story_orphanqueries_found.txt", this.foundOrphans);

			const goalNames = (await extractPathsInPackage(this.path, this.internalPath + "/Story/RawFiles/Goals")).map(
				(value) => value.substring(0, value.length - 4)
			);
			const osiPath = (await extractFromPak(this.path, this.internalPath + "/Story/story.div.osi"))
				.OutputPaths[0];
			if (osiPath) {
				this.initializeWithStory(goalNames, osiPath);
			} else {
				this.goalParents = new Map<string, string>();
				this.initializeWithoutStory(goalNames);
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

	private async initializeWithoutStory(goalNames: string[]) {
		for (let i = 0; i < goalNames.length; i++) {
			this.activeGoals.set(i, goalNames[i]);
			const goalPath = await extractFromPak(
				this.path,
				`${this.internalPath}/Story/RawFiles/Goals/${goalNames[i]}.txt`
			);

			const matched = readFileSync(goalPath.OutputPaths[0], { encoding: "utf-8" }).match(
				/ParentTargetEdge ("[a-zA-Z0-9_-]*")?/
			);
			if (matched) {
				const parent = matched[0].split(" ")[1];
				this.goalParents?.set(goalNames[i], parent.substring(1, parent.length - 1));
			} else {
				this.goalParents?.set(goalNames[i], "");
			}

			rmSync(goalPath.OutputPaths[0]);
		}
	}

	private async initializeWithStory(goalNames: string[], osiPath: string) {
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
	}
}
