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
