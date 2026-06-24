import { ModMetaModuleInfo } from "./modMeta";
import { readdirSync, rmSync } from "fs";
import { StoryTree } from "./storyTree";
import { GoalResource } from "./resource/goalResource";
import { join, sep } from "path";
import { extractFromPak } from "../utils/edge";
import { ModManager } from "../components/modManager";
import { readdir } from "fs/promises";
import { Resource } from "./resource/resource";
import { Dependency } from "./dependency";
import { Story } from "./story";

export class Mod {
	readonly meta?: ModMetaModuleInfo;
	readonly manager: ModManager;
	readonly story?: Story;
	private readonly goals: GoalResource[] = [];
	private readonly goalSubdirectory = join("Story", "RawFiles", "Goals");
	private path: string;
	private dependencies: Dependency[] = [];
	storyTree = new StoryTree();

	constructor(path: string, manager: ModManager, meta?: ModMetaModuleInfo) {
		this.path = path;
		this.manager = manager;
		this.meta = meta;
	}

	// For each dependency, load all goals from the raw files. Preexisting goals are overwritten by
	// any newly read raw files. When a goal is overwritten, check all associated definitions. If there
	// are new signatures, add them. If a signature no longer exists, delete it.
	/**
	 * Initializes this {@link Mod}.
	 *
	 * @param directory This mod's path.
	 */
	async initialize() {
		for (const file of await readdir(join(this.path, this.goalSubdirectory))) {
			if (this.path) {
				this.goals.push(new GoalResource(this, file, join(this.path, this.goalSubdirectory, file)));
			}
		}

		if (!this.meta) return;

		const dependencies = await Promise.all(
			(await this.findDependencies(this.meta)).map(async (dependencyPak) => {
				const dependency = new Dependency(dependencyPak);
				await dependency.initialize();
				return dependency;
			})
		);
		this.dependencies.push(...dependencies);
	
	}

	getResource(path: string): Resource | undefined {
		return this.goals.find((file) => file.path === path);
	}

	getAllGoals(): GoalResource[] {
		return this.goals;
	}

	/**
	 * Recursively gets a set of paths to the mod's dependencies.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod whose dependencies should be loaded.
	 * @param res The result so far.
	 * @returns A set of dependency paks.
	 */
	private async findDependencies(meta: ModMetaModuleInfo, fullRes?: string[]): Promise<string[]> {
		const res = fullRes ? fullRes : [];
		if (!meta.dependencies) return res;

		const files: string[] = (
			(await this.manager.server.connection.workspace.getConfiguration("bg3Osiris.dependencyPaths")) as string[]
		)
			.map((value) => {
				return readdirSync(value).map((path) => {
					return join(value, path);
				});
			})
			.flat(1);

		for (const dependency of meta.dependencies) {
			const searchName = this.manager.baseMods.find((modName) => modName === dependency.name)
				? dependency.name === "Shared" || dependency.name === "SharedDev"
					? "Shared"
					: "Gustav"
				: dependency.name;

			const dependencyPak = files.find((path) => {
				const file = path.split(sep).pop();
				return (
					`${searchName}.pak` === file ||
					`${searchName}_${meta.uuid}.pak` === file ||
					`${meta.uuid}.pak` === file
				);
			});

			// TODO: Make sure mods packed together don't have multiple meta.lsx files?
			if (dependencyPak) {
				if (!this.manager.baseMods.find((value) => value === dependency.name)) {
					const dependencyMetaFile = await extractFromPak(dependencyPak, "meta.lsx");
					const dependencyMetaInfo = this.manager.readModMeta(dependencyMetaFile);
					if (dependencyMetaInfo) {
						await this.findDependencies(dependencyMetaInfo, res);
						rmSync(dependencyMetaFile);
					}
				}
				if (!res.find((value) => value === dependencyPak)) res.push(dependencyPak);
			} else {
				console.error(`Couldn't find dependency ${dependency.name} for ${meta.name}`);
			}
		}

		return res;
	}
}
