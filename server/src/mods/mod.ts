import { readdir } from "fs/promises";
import { ModMetaModuleInfo } from "./modMeta";
import { dirname, join } from "path";
import { Resource } from "./resource/resource";
import { GoalResource } from "./resource/goalResource";
import { ModManager } from "../components/modManager";
import { readdirSync } from "fs";

export class Mod {
	readonly meta: ModMetaModuleInfo;
	readonly manager: ModManager;
	private readonly dependencyFiles: Resource[] = [];
	private readonly files: Resource[] = [];
	private readonly goalSubdirectory = join("Story", "RawFiles", "Goals");
	private path: string;

	constructor(meta: ModMetaModuleInfo, path: string, manager: ModManager) {
		this.meta = meta;
		this.manager = manager;
		this.path = path;
	}

	/**
	 * Initializes this {@link Mod}.
	 *
	 * @param directory This mod's path.
	 */
	async initialize() {
		for (const file of await readdir(join(this.path, this.goalSubdirectory))) {
			if (this.path) {
				this.files.push(new GoalResource(this, file, join(this.path, this.goalSubdirectory, file)));
			}
		}

		for (const dependency of this.findDependencies(this.meta, this.path)) {
			for (const file of await readdir(join(dependency, this.goalSubdirectory))) {
				this.dependencyFiles.push(new GoalResource(this, file, join(dependency, this.goalSubdirectory, file)));
			}
		}
	}

	getResource(path: string): Resource | undefined {
		return this.files.find((file) => file.path == path);
	}

	getAllResources(): Resource[] {
		return this.files;
	}

	/**
	 * Recursively gets a set of paths to the mod's dependencies.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod whose dependencies should be loaded.
	 * @param path The path to the mod directory whose dependencies should be loaded.
	 * Should contain the mod's meta.lsx.
	 * @returns A set of dependency folders.
	 */
	private findDependencies(meta: ModMetaModuleInfo, path: string, fullRes?: Set<string>): Set<string> {
		const res = fullRes ? fullRes : new Set<string>();
		if (meta.dependencies) {
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
				const loadedMeta = this.manager.readModMeta(join(modDir, dependencyFolder));
				if (loadedMeta) {
					this.findDependencies(loadedMeta, join(modDir, dependencyFolder), res);
				}

				res.add(join(modDir, dependencyFolder));
			}
		}
		return res;
	}
}
