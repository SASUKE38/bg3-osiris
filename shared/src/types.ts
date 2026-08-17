export interface StoryTreeNode {
	children: StoryTreeNode[];
	parent?: string;
	data?: StoryTreeData;
}

export interface StoryTreeData {
	name: string;
	dependency?: string;
}
