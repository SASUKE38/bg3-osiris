import { ModMetaModuleInfo } from "./modMeta";

export class Mod {
	private meta: ModMetaModuleInfo;

	constructor(meta: ModMetaModuleInfo) {
		this.meta = meta;
	}
}
