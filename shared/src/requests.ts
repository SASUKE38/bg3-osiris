export const requestGetInheritedGoalContent = "bg3Osiris/getInheritedGoalContent";
export interface RequestGetInheritedGoalContentParams {
	goalName: string;
}
export interface RequestGetInheritedGoalContentResult {
	content: string | undefined;
}
