import { Range } from 'vscode-languageserver';

export interface ASTNode {
	range: Range;
}

export interface RootNode extends ASTNode {
	init: Array<SignatureNode>;
	kb: Array<RuleNode>;
	exit: Array<SignatureNode>;
}

export interface SignatureNode extends ASTNode {
	name: string;
	parameters: Array<ParameterNode>;
}

export interface ParameterNode extends ASTNode {
	content: ASTNode;
	type: TypeNode | null;
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