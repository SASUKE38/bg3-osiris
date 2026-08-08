import { StoryTreeNode } from "./types";

export const requestGetInheritedGoalContent = "bg3Osiris/getInheritedGoalContent";
export interface RequestGetInheritedGoalContentParams {
	goalName: string;
}
export interface RequestGetInheritedGoalContentResult {
	content: string | undefined;
}

export const requestGetStoryTreeNodeChildren = "bg3Osiris/getStoryTreeNodeChildren";
export interface RequestGetStoryTreeNodeChildrenParams {
	name: string;
}
export interface RequestGetStoryTreeNodeChildrenResult {
	children: [StoryTreeNode, boolean][];
}

export const requestGetStoryTreeNodePath = "bg3Osiris/getStoryTreeNodePath";
export interface RequestGetStoryTreeNodePathParams {
	name: string;
}
export interface RequestGetStoryTreeNodePathResult {
	path: string | undefined | null;
}

export const requestTestStoryTreeName = "bg3Osiris/testStoryTreeName";
export interface RequestTestStoryTreeNameParams {
	name: string;
}
export interface RequestTestStoryTreeNameResult {
	reason: string;
}

export const requestAddStoryTreeNode = "bg3Osiris/addStoryTreeNode";
export interface RequestAddStoryTreeNodeParams {
	parent: string;
	name: string;
}
export interface RequestAddStoryTreeNodeResult {
	path?: string;
}

export const requestOverrideStoryTreeNode = "bg3Osiris/overrideStoryTreeNode";
export interface RequestOverrideStoryTreeNodeParams {
	name: string;
}
export interface RequestOverrideStoryTreeNodeResult {
	success: boolean;
}
