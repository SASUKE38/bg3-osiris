import { ModMetaModuleInfo } from "./modMeta";
import { Story } from "./story/story";

export class Mod {
	readonly path?: string;
	readonly meta: ModMetaModuleInfo;
	readonly story: Story = new Story(this);

	constructor(meta: ModMetaModuleInfo, path?: string) {
		this.meta = meta;
		this.path = path;
	}

	/**
	 * Initializes this {@link Mod}.
	 *
	 * @param directory This mod's path.
	 */
	async initialize(directory: string) {
		this.story.initialize(directory, this.meta);
	}
}
