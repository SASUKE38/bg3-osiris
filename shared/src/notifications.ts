import { StoryTreeNode } from "./types";

export const notificationClientRunning = "bg3Osiris/clientRunning";

export const notificationServerRunning = "bg3Osiris/serverRunning";

export const notificationStoryTreeCreated = "bg3Osiris/storyTreeChanged";
export interface notificationStoryTreeCreatedParams {
	folder: string;
	mapping: Record<string, StoryTreeNode>;
}
