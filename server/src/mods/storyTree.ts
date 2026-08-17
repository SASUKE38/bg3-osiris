import { StoryTreeChildData, StoryTreeNode } from "bg3-osiris-shared";
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

	/**
	 * Creates the story tree for the mod. This class's {@link nodeMapping} is
	 * filled with data from the mod's resources and dependencies. The completion of
	 * this method signals that the story tree is ready for further processing.
	 *
	 * @param resources The mod's resources.
	 * @param dependencies The mod's dependencies.
	 */
	createTree(resources: GoalResource[], dependencies: Dependency[]) {
		this.isReady = false;
		if (!this.mod.manager.server.rootFolder) return;

		const handledGoals = new Set<string>();
		this.nodeMapping.clear();
		this.nodeMapping.set("", { children: [] });

		function trimExtension(name: string) {
			return name.endsWith(".txt") ? name.substring(0, name.length - 4) : name;
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
			this.addToTree(name, value.parent);
			handledGoals.add(name);
		});

		dependencies.reverse().forEach((value) => {
			for (const entry of value.activeGoals.entries()) {
				if (handledGoals.has(entry[1])) continue;
				const parentReference = value.story?.goals[entry[0]].ParentGoals[0];
				const parent = parentReference ? value.story?.goals[parentReference.Index].Name : "";
				if (parent || parent === "") {
					this.addToTree(entry[1], parent);
					handledGoals.add(entry[1]);
				}
			}
		});
		this.isReady = true;
	}

	/**
	 * Blocks any calls awaiting this function's return until the story tree is constructed.
	 */
	private async waitForReady() {
		await waitUntil(() => this.isReady, { timeout: WAIT_FOREVER });
	}

	/**
	 * Assigns a parent/child relationship in the story tree.
	 *
	 * @param name The name of the node to add.
	 * @param parent The name of the parent of the node to add.
	 */
	private addToTree(name: string, parent: string) {
		const parentNode = this.nodeMapping.get(parent);
		const childNode = this.nodeMapping.get(name);
		if (parentNode && childNode) {
			parentNode.children.push(childNode);
			childNode.parent = parentNode.data?.name ? parentNode.data.name : "";
		}
	}

	/**
	 * Gets data for each child of a given node. That is, gets each child's {@link StoryTreeNode},
	 * whether each child is overriden, and whether each child has children.
	 *
	 * @param name The name of the node whose children should be found.
	 * @returns An array of {@link StoryTreeChildData} instances.
	 */
	async getStoryTreeNodeChildren(name: string): Promise<StoryTreeChildData[]> {
		await this.waitForReady();
		const node = this.nodeMapping.get(name);
		if (!node) return [];
		const res: StoryTreeChildData[] = [];
		for (const child of node.children) {
			const isOverriden =
				!child.data || child.data.name === ""
					? false
					: this.mod.getResource(`${child.data.name}.txt`, "name") !== undefined;
			res.push({ node: child, isOverriden, hasChildren: child.children.length > 0 });
		}
		return res;
	}

	/**
	 * Adds a node to the story tree with the given parent and children.
	 *
	 * @param parent The parent of the new node.
	 * @param name The name of the node to add.
	 * @param children Any children the node to add has.
	 */
	async addStoryTreeNode(parent: string, name: string, children: StoryTreeNode[] = []) {
		await this.waitForReady();
		const childNode: StoryTreeNode = { children, data: { name } };
		const parentNode = this.nodeMapping.get(parent);
		childNode.parent = parentNode?.data?.name ? parentNode.data.name : "";
		this.nodeMapping.set(name, childNode);
		if (!parentNode) {
			console.error(`No goal with the name ${parent} could be found.`);
			return;
		}
		parentNode.children.push(childNode);
	}

	/**
	 * Deletes a node from the story tree. References to this node in the parent
	 * and any children are removed.
	 *
	 * @param name The name of the node to delete.
	 */
	async deleteStoryTreeNode(name: string) {
		await this.waitForReady();
		const childNode = this.nodeMapping.get(name);
		if (!childNode || childNode.parent === undefined) return;

		const parentNode = this.nodeMapping.get(childNode.parent);
		const childIndex = parentNode?.children.findIndex((value) => value.data?.name === name);
		if (childIndex !== undefined) parentNode?.children.splice(childIndex, 1);

		const dependency = this.mod.getInheritedGoalOwner(name);
		if (dependency) {
			const goal = Array.from(dependency.activeGoals.entries()).find((value) => value[1] === name);
			if (!goal) return;
			const parentReference = dependency.story?.goals[goal[0]].ParentGoals[0];
			const parent = parentReference ? dependency.story?.goals[parentReference.Index].Name : "";
			if (parent || parent === "") this.addToTree(goal[1], parent);
		} else {
			this.nodeMapping.delete(name);
		}
	}

	/**
	 * Changes the name of a story tree node. That is, deletes the old node
	 * and adds a new copy of the node with the original parent and child relationships.
	 *
	 * @param targetName The new name of the node.
	 * @param oldName The old name of the node.
	 */
	async renameStoryTreeNode(targetName: string, oldName: string) {
		await this.waitForReady();
		const node = this.nodeMapping.get(oldName);
		await this.deleteStoryTreeNode(oldName);
		if (!node) return;
		await this.addStoryTreeNode(node.parent ? node.parent : "", targetName, node ? node.children : []);
	}

	/**
	 * Changes the parent of a given story tree node. That is, deletes the node
	 * and adds a copy of the node to the tree with the new parent.
	 *
	 * @param targetName The name of the node to move the node to.
	 * @param sourceName The node to move.
	 */
	async moveStoryTreeNode(targetName: string, sourceName: string) {
		await this.waitForReady();
		const node = this.nodeMapping.get(sourceName);
		await this.deleteStoryTreeNode(sourceName);
		await this.addStoryTreeNode(targetName, sourceName, node ? node.children : []);
	}
}
