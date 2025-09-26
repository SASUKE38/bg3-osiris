export class ASTNode {
	line: number;
	col: number;

	constructor(line: number, col: number) {
		this.line = line;
		this.col = col;
	}
}

export class RootNode extends ASTNode {
	init: Array<SignatureNode>;
	kb: Array<RuleNode>;
	exit: Array<SignatureNode>;

	constructor(init: Array<SignatureNode>, kb: Array<RuleNode>, exit: Array<SignatureNode>) {
		super(0, 0);
		this.init = init;
		this.kb = kb;
		this.exit = exit;
	}
}

export class SignatureNode extends ASTNode {
	name: string;
	parameters: Array<ParameterNode> = [];

	constructor(name: string, line: number, col: number) {
		super(line, col);
		this.name = name;
	}
}

export class ParameterNode extends ASTNode {
	content: ASTNode;
	type: TypeNode | null;

	constructor(content: ASTNode, type: TypeNode | null = null, line: number, col: number) {
		super(line, col);
		this.content = content;
		this.type = type;
	}
}

export class StringNode extends ASTNode {
	value: string;

	constructor(value: string, line: number, col: number) {
		super(line, col);
		this.value = value;
	}
}

export class IdentifierNode extends ASTNode {
	symbol: string;

	constructor(symbol: string, line: number, col: number) {
		super(line, col);
		this.symbol = symbol;
	}
}

export class NumberNode extends ASTNode {
	value: number;

	constructor(value: number, line: number, col: number) {
		super(line, col);
		this.value = value;
	}
}

export class TypeNode extends ASTNode {
	value: string;

	constructor(value: string, line: number, col: number) {
		super(line, col);
		this.value = value;
	}
}

export class RuleNode extends ASTNode {
	type: string;
	call: SignatureNode;
	conditions: Array<SignatureNode | ComparisonNode> = [];
	actions: Array<SignatureNode> = [];

	constructor(type: string, call: SignatureNode, line: number, col: number) {
		super(line, col);
		this.type = type;
		this.call = call;
	}
}

export class ComparisonNode extends ASTNode {
	left: ASTNode;
	operator: OperatorNode;
	right: ASTNode;

	constructor(left: ASTNode, operator: OperatorNode, right: ASTNode, line: number, col: number) {
		super(line, col);
		this.left = left;
		this.operator = operator;
		this.right = right;
	}
}

export class OperatorNode extends ASTNode {
	operator: string;

	constructor(operator: string, line: number, col: number) {
		super(line, col);
		this.operator = operator;
	}
}