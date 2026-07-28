export const requestGetInheritedGoalContent = "bg3Osiris/getInheritedGoalContent";
export interface RequestGetInheritedGoalContentParams {
	goalName: string;
}
export interface RequestGetInheritedGoalContentResult {
	content: string | undefined;
}

export const requestGetGoalPath = "bg3Osiris/getGoalPath";
export interface RequestGetGoalPathParams {
	name: string
}
export interface RequestGetGoalPathResult {
	path?: string
}