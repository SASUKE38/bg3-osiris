import { Range } from 'vscode-languageserver';

export enum ParameterFlow {
	IN,
	OUT
}

// Base Nodes

export interface ASTNode {
	range: Range;
}

export interface SignatureNode extends ASTNode {
	name: string;
	parameters: ParameterNode[];
	signatureType?: string;
}

export interface ParameterNode extends ASTNode {
	content: ASTNode;
	type: TypeNode | null;
	flow?: ParameterFlow | null;
}

export interface StringNode extends ASTNode {
	value: string;
}

export interface IdentifierNode extends ASTNode {
	symbol: string;
}

export interface NumberNode extends ASTNode {
	value: number;
}

// Goal Nodes

export interface GoalNode extends ASTNode {
	init: SignatureNode[];
	kb: RuleNode[];
	exit: SignatureNode[];
}

export interface TypeNode extends ASTNode {
	value: string;
}

export interface RuleNode extends ASTNode {
	type: string;
	call: SignatureNode;
	conditions: (SignatureNode | ComparisonNode)[];
	actions: SignatureNode[];
}

export interface ComparisonNode extends ASTNode {
	left: ASTNode;
	operator: OperatorNode;
	right: ASTNode;
}

export interface OperatorNode extends ASTNode {
	operator: string;
}

export interface TypeEnumMemberNode extends ASTNode {
	type: string,
	member: string
}

// Header Nodes

export interface HeaderNode extends ASTNode {
	options: IdentifierNode[];
	types: (AliasTypeNode | EnumTypeNode)[];
	builtinSignatures: SignatureNode[];
	version: StringNode | null;
	headerGoals: HeaderGoalNode[];
}

export interface AliasTypeNode extends ASTNode {
	type: string;
}

export interface EnumTypeNode extends ASTNode {
	type: string;
	members: string[];
}

export interface HeaderGoalNode extends ASTNode {
	id: number;
	children: number[];
	title?: StringNode;
	init?: string;
	kb?: string;
	exit?: string;
}