import { StoryTreeNode } from "bg3-osiris-shared";
import { Dependency } from "./dependency";
import { GoalResource } from "./resource/goalResource";
import { Mod } from "./mod";
import waitUntil, { WAIT_FOREVER } from "async-wait-until";

export class StoryTree {
	nodeMapping = new Map<string, StoryTreeNode>();
	private mod: Mod;
	private isReady = false;

	constructor(mod: Mod) {
		this.mod = mod;
	}

	createTree(resources: GoalResource[], dependencies: Dependency[]) {
		if (!this.mod.manager.server.rootFolder) return;

		const handledGoals = new Set<string>();
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
			this.nodeMapping.set(name, { children: [], data: { name } });
		});

		resources.forEach((value) => {
			const name = trimExtension(value.name);
			addToTree(name, value.parent, this);
			handledGoals.add(name);
		});

		dependencies.reverse().forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				if (handledGoals.has(entry[1])) continue;
				const parentReference = value.story?.goals[entry[0]].ParentGoals[0];
				const parent = parentReference ? value.story?.goals[parentReference.Index].Name : "";
				if (parent || parent === "") {
					addToTree(entry[1], parent, this);
					handledGoals.add(entry[1]);
				}
			}
		});
		this.isReady = true;
	}

	async getStoryTreeNodeChildren(name: string): Promise<[StoryTreeNode, boolean][]> {
		await waitUntil(() => this.isReady, { timeout: WAIT_FOREVER });
		const node = this.nodeMapping.get(name);
		if (!node) return [];
		const res: [StoryTreeNode, boolean][] = [];
		for (const child of node.children) {
			res.push([child, this.mod.getResource !== undefined]);
		}
		return res;
	}
}
