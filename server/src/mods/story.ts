export interface Story {
	databases: { [key: number]: Database };
	enums: { [key: number]: Enum };
	functions: Function[];
	functionSignatureMap: { [key: string]: Function };
	goals: { [key: number]: Goal };
	types: { [key: number]: Type };
	nodes: { [key: number]: Node };
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
	NumParams: any;
}

export interface EnumElement {
	Name: string;
	Value: number;
}

export interface Enum {
	UnderlyingValue: number;
	Elements: EnumElement[];
}

export interface Type {
	Alias: any;
	Index: any;
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
	Type: string;
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
	Facts: any[];
	OwnerNode: any;
}

export interface Goal {
	Index: number;
	Name: string;
	SubGoalCombination: any;
	ParentGoals: Reference[];
	SubGoals: Reference[];
	Flags: any;
	InitCalls: Call[];
	ExitCalls: Call[];
}

export interface Call {
	Name: string;
	Parameters: any[];
	Negate: boolean;
	GoalIdOrDebugHook: number;
}
