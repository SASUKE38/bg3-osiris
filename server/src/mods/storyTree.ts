import {
	notificationStoryTreeCreated,
	notificationStoryTreeCreatedParams,
	requestGetInheritedGoalContent,
	StoryTreeNode
} from "bg3-osiris-shared";
import { Dependency } from "./dependency";
import { GoalResource } from "./resource/goalResource";
import { Mod } from "./mod";

export class StoryTree {
	nodeMapping = new Map<string, StoryTreeNode>();
	private mod: Mod;

	constructor(mod: Mod) {
		this.mod = mod;
	}

	createTree(resources: GoalResource[], dependencies: Dependency[]) {
		if (!this.mod.manager.server.rootFolder) return;
		this.nodeMapping.clear();
		this.nodeMapping.set("", { children: [] });

		function trimExtension(name: string) {
			return name.endsWith(".txt") ? name.substring(0, name.length - 4) : name;
		}

		function addToTree(name: string, parent: string, thisArg: StoryTree) {
			const parentNode = thisArg.nodeMapping.get(parent);
			const childNode = thisArg.nodeMapping.get(name);
			if (parentNode && childNode) {
				parentNode.children.push(childNode);
			}
		}

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			this.nodeMapping.set(name, { children: [], data: { name: value.name } });
		});

		dependencies.forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				const goal = value.story?.goals[entry[0]];
				if (goal) {
					this.nodeMapping.set(goal.Name, {
						children: [],
						data: { name: goal.Name, dependency: value.path }
					});
				}
			}
		});

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			addToTree(name, value.parent, this);
		});

		dependencies.forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				const parentReference = value.story?.goals[entry[0]].ParentGoals[0];
				const parent = parentReference ? value.story?.goals[parentReference.Index].Name : "";
				if (parent || parent === "") addToTree(entry[1], parent, this);
			}
		});

		const params: notificationStoryTreeCreatedParams = {
			folder: this.mod.manager.server.rootFolder.uri,
			mapping: Object.fromEntries(this.nodeMapping)
		};
		this.mod.manager.server.connection.sendNotification(notificationStoryTreeCreated, params);
	}
}
