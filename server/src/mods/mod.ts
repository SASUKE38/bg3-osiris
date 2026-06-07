import { ModMetaModuleInfo } from "./modMeta";
import { readdirSync, rmSync } from "fs";
import { Dependency } from "./dependency";
import { StoryTree } from "./storyTree";
import { GoalResource } from "./resource/goalResource";
import { join, sep } from "path";
import { extractFromPak } from "../utils/edge";

export class Mod extends Dependency {
	private readonly dependencies: Dependency[] = [];
	private readonly externalGoals = new Map<string, GoalResource>();
	storyTree = new StoryTree();

	/**
	 * Initializes this {@link Mod}.
	 *
	 * @param directory This mod's path.
	 */
	async initialize() {
		super.initialize();

		if (this.meta) {
			for (const dependency of await this.findDependencies(this.meta)) {
				// const mod = await this.manager.createModFromPath(dependency, true);
				// if (!mod) continue;
				// this.dependencies.push(mod);
				// this.setExternalGoals(mod.getAllGoals());
			}
		}

		this.setExternalGoals(this.getAllGoals());
	}

	private setExternalGoals(resources: GoalResource[]) {
		for (const resource of resources) {
			this.externalGoals.set(resource.name, resource);
		}
	}

	getAllExternalGoals() {
		return this.externalGoals.values();
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
