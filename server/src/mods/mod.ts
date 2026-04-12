import { ModMetaModuleInfo } from "./modMeta";

export class Mod {
	readonly meta: ModMetaModuleInfo;

	constructor(meta: ModMetaModuleInfo) {
		this.meta = meta;
	}

	async initialize() {}
}
