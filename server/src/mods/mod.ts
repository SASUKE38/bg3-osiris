import { readdir } from "fs/promises";
import { ModMetaModuleInfo } from "./modMeta";
import { join } from "path";
import { Resource } from "./resource/resource";
import { GoalResource } from "./resource/goalResource";
import { ModManager } from './modManager';

export class Mod {
	readonly meta: ModMetaModuleInfo;
	readonly manager: ModManager;
	private files: Resource[] = [];
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
		const contents = await readdir(join(this.path, "Story", "RawFiles", "Goals"));
		for (const file of contents) {
			this.createResource(file);
		}
	}

	createResource(file: string) {
		if (this.path) {
			this.files.push(new GoalResource(this, join(this.path, "Story", "RawFiles", "Goals", file)));
		}
	}

	getResource(path: string): Resource | undefined {
		return this.files.find((file) => file.path == path);
	}

	getAllResources(): Resource[] {
		return this.files;
	}
}
