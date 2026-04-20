import { ModMetaModuleInfo } from "./modMeta";
import { Story } from "./story/story";

export class Mod {
	readonly meta: ModMetaModuleInfo;
	readonly story: Story = new Story();

	constructor(meta: ModMetaModuleInfo) {
		this.meta = meta;
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
