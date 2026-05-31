import { ModMetaModuleInfo } from "./modMeta";
import { dirname, join } from "path";
import { Resource } from "./resource/resource";
import { readdirSync } from "fs";
import { Dependency } from './dependency';

export class Mod extends Dependency {
	private readonly dependencies: Dependency[] = [];
	private readonly activeFiles = new Map<string, Resource>();

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
				this.setActiveFiles(mod.getAllResources());
			}
		}

		this.setActiveFiles(this.getAllResources());
	}

	private setActiveFiles(resources: Resource[]) {
		for (const resource of resources) {
			this.activeFiles.set(resource.name, resource);
		}
	}

	getAllActiveFiles() {
		return this.activeFiles.values();
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
