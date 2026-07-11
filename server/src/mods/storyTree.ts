import { Dependency } from "./dependency";
import { GoalResource } from "./resource/goalResource";

export interface StoryTreeRoot {
	children: StoryTreeNode[];
}

export interface StoryTreeNode extends StoryTreeRoot {
	data?: StoryTreeData;
}

export interface StoryTreeData {
	name: string;
	dependency?: string;
}

export class StoryTree {
	root: StoryTreeRoot = { children: [] };

	createTree(resources: GoalResource[], dependencies: Dependency[]) {
		const mapping = new Map<string, StoryTreeNode>();
		mapping.set("", { children: [] });

		function trimExtension(name: string) {
			return name.endsWith(".txt") ? name.substring(0, name.length - 4) : name;
		}

		function addToTree(name: string, parent: string) {
			const parentNode = mapping.get(parent);
			const childNode = mapping.get(name);
			if (parentNode && childNode) {
				parentNode.children.push(childNode);
			}
		}

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			mapping.set(name, { children: [], data: { name: value.name } });
		});

		dependencies.forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				const goal = value.story?.goals[entry[0]];
				if (goal) {
					mapping.set(goal.Name, { children: [], data: { name: goal.Name, dependency: value.path } });
				}
			}
		});

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			addToTree(name, value.parent);
		});

		dependencies.forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				const parentReference = value.story?.goals[entry[0]].ParentGoals[0];
				const parent = parentReference ? value.story?.goals[parentReference.Index].Name : "";
				if (parent || parent === "") addToTree(entry[1], parent);
			}
		});

		this.root.children = mapping.get("")?.children as StoryTreeNode[];
	}
}
