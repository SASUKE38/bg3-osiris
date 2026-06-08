import { GoalResource } from "./resource/goalResource";

export interface StoryTreeRoot {
	children: StoryTreeNode[];
}

export interface StoryTreeNode extends StoryTreeRoot {
	resource?: GoalResource;
}

export class StoryTree {
	root: StoryTreeRoot = { children: [] };

	createTree(resources: GoalResource[]) {
		const mapping = new Map<string, StoryTreeNode>();
		mapping.set("", { children: [] });

		function trimExtension(name: string) {
			return name.endsWith(".txt") ? name.substring(0, name.length - 4) : name;
		}

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			mapping.set(name, { children: [], resource: value });
		});

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			const parent = mapping.get(value.parent);
			const child = mapping.get(name);
			if (parent && child) {
				parent.children.push(child);
			}
		});

		this.root.children = mapping.get("")?.children as StoryTreeNode[];
	}
}
