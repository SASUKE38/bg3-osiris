export interface StoryTreeNode {
	children: StoryTreeNode[];
	data?: StoryTreeData;
}

export interface StoryTreeData {
	name: string;
	dependency?: string;
}
