import { join } from 'path';
import { ModManager } from '../components/modManager';
import { ModMetaModuleInfo } from './modMeta';
import { Resource } from './resource/resource';
import { GoalResource } from './resource/goalResource';
import { readdir } from 'fs/promises';

export class Dependency {
	readonly meta?: ModMetaModuleInfo;
	readonly manager: ModManager;
	protected readonly files: Resource[] = [];
	protected readonly goalSubdirectory = join("Story", "RawFiles", "Goals");
	protected path: string;

	constructor(path: string, manager: ModManager, meta?: ModMetaModuleInfo) {
		this.path = path;
		this.manager = manager;
		this.meta = meta;
	}

	async initialize() {
		for (const file of await readdir(join(this.path, this.goalSubdirectory))) {
			if (this.path) {
				this.files.push(new GoalResource(this, file, join(this.path, this.goalSubdirectory, file)));
			}
		}
	}

	getResource(path: string): Resource | undefined {
		return this.files.find((file) => file.path === path);
	}

	getAllResources(): Resource[] {
		return this.files;
	}
}