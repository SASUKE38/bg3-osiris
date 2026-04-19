import { readdir } from "fs/promises";
import { ModMetaModuleInfo } from "../modMeta";
import { Resource } from "../resource/resource";
import { Goal } from "./goal";
import { join } from "path";
import { EventEmitter } from "events";
import { GoalResource } from "../resource/goalResource";

export class Story extends EventEmitter {
	private meta?: ModMetaModuleInfo;
	private goals: Goal[] = [];
	private files: Resource[] = [];
	private isInitialized = false;

	/**
	 * Loads the Story resources associated with a given mod.
	 * 
	 * @param directory The path to the mod associated with this {@link Story}. Should contain the mod's meta.lsx.
	 * @param meta The {@link ModMetaModuleInfo} of the mod associated with this {@link Story}.
	 */
	async initialize(directory: string, meta: ModMetaModuleInfo) {
		this.meta = meta;
		const contents = await readdir(join(directory, "Story", "RawFiles", "Goals"));
		for (const file of contents) {
			this.files.push(new GoalResource(this, join(directory, "Story", "RawFiles", "Goals", file)));
		}
		this.emit("storyInitialized");
	}

	getResource(path: string): Resource | undefined {
		return this.files.find((file) => file.path == path);
	}
}
