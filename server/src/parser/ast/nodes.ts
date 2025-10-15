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
	parameters: Array<ParameterNode>;
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
	init: Array<SignatureNode>;
	kb: Array<RuleNode>;
	exit: Array<SignatureNode>;
}

export interface TypeNode extends ASTNode {
	value: string;
}

export interface RuleNode extends ASTNode {
	type: string;
	call: SignatureNode;
	conditions: Array<SignatureNode | ComparisonNode>;
	actions: Array<SignatureNode>;
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
	options: Array<IdentifierNode>;
	types: Array<AliasTypeNode | EnumTypeNode>;
	builtinSignatures: Array<SignatureNode>;
	version: StringNode | null;
	headerGoals: Array<HeaderGoalNode>;
}

export interface AliasTypeNode extends ASTNode {
	type: string;
}

export interface EnumTypeNode extends ASTNode {
	type: string;
	members: Array<string>;
}

export interface HeaderGoalNode extends ASTNode {
	id: number;
	children: Array<number>;
	title?: StringNode;
	init?: string;
	kb?: string;
	exit?: string;
}