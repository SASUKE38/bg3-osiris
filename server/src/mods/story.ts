export interface Story {
	databases: Record<number, Database>;
	enums: Record<number, Enum>;
	functions: Function[];
	functionSignatureMap: Record<string, Function>;
	goals: Record<number, Goal>;
	types: Record<number, Type>;
	nodes: Record<number, Node>;
}

export interface NodeEntryItem {
	EntryPoint: string;
	NodeRef: Reference;
	GoalRef: Reference;
}

export interface Node {
	ReferencedBy?: NodeEntryItem[];
	Index: number;
	DatabaseRef: Reference;
	Name: string;
	NumParams: never;
}

export interface EnumElement {
	Name: string;
	Value: number;
}

export interface Enum {
	UnderlyingType: number;
	Elements: EnumElement[];
}

export interface Type {
	Alias: never;
	Index: never;
	IsBuiltin: boolean;
	Name: string;
}

export interface Function {
	ActionReferences: number;
	ConditionReferences: number;
	Line: number;
	Meta1: number;
	Meta2: number;
	Meta3: number;
	Meta4: number;
	Name: FunctionSignature;
	NodeRef: Reference;
	Type: "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery";
}

export function getReadableInheritedSignatureType(
	type: "Event" | "Call" | "Query" | "Database" | "Proc" | "SysQuery" | "SysCall" | "UserQuery"
) {
	switch (type) {
		case "Event":
			return "event";
			break;
		case "Call":
			return "call";
			break;
		case "Query":
			return "query";
			break;
		case "Database":
			return "database";
			break;
		case "Proc":
			return "proc";
			break;
		case "SysQuery":
			return "query";
			break;
		case "SysCall":
			return "call";
			break;
		case "UserQuery":
			return "user-defined query";
			break;
	}
}

export interface FunctionSignature {
	Name: string;
	OutParamMask: Uint8Array;
	Parameters: ParameterList;
}

export interface ParameterList {
	Types: Uint32Array;
}

export interface Reference {
	Index: number;
	IsNull: boolean;
	IsValid: boolean;
}

export interface Database {
	Index: number;
	Parameters: ParameterList;
	Facts: never[];
	OwnerNode: Node;
}

export interface Goal {
	Index: number;
	Name: string;
	SubGoalCombination: never;
	ParentGoals: Reference[];
	SubGoals: Reference[];
	Flags: never;
	InitCalls: Call[];
	ExitCalls: Call[];
}

export interface Call {
	Name: string;
	Parameters: never[];
	Negate: boolean;
	GoalIdOrDebugHook: number;
}
