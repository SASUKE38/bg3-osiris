import { ModMetaModuleInfo } from "./modMeta";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import { Dependency } from "./dependency";
import { StoryTree } from "./storyTree";
import { GoalResource } from "./resource/goalResource";

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
			for (const dependency of this.findDependencies(this.meta, this.path)) {
				const mod = await this.manager.createModFromPath(dependency, true);
				if (!mod) continue;

				this.dependencies.push(mod);
				this.setExternalGoals(mod.getAllGoals());
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
	 * @param path The path to the mod directory whose dependencies should be loaded.
	 * Should contain the mod's meta.lsx.
	 * @returns A set of dependency folders.
	 */
	private findDependencies(meta: ModMetaModuleInfo, path: string, fullRes?: string[]): string[] {
		const res = fullRes ? fullRes : [];
		if (!meta.dependencies) return res;

		const modDir = dirname(path);
		const contents = readdirSync(modDir);
		for (const dependency of meta.dependencies) {
			const dependencyFolder = contents.find((item) => {
				return (
					dependency.name + "_" + dependency.uuid === item ||
					dependency.uuid === item ||
					dependency.name === item
				);
			});

			if (!dependencyFolder) {
				console.error(`Couldn't find dependency ${dependency.name} for ${meta.name}`);
				continue;
			}

			const dependencyPath = join(modDir, dependencyFolder);
			const loadedMeta = this.manager.readModMeta(dependencyPath);
			if (loadedMeta) {
				this.findDependencies(loadedMeta, dependencyPath, res);
			}

			if (!res.find((value) => value === dependencyPath)) res.push(dependencyPath);
		}
		return res;
	}
}
