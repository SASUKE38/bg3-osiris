import { Range } from "vscode-languageserver";

export enum ParameterFlow {
	IN,
	OUT
}

export enum ASTNodeKind {
	NONE,
	UNKNOWN,
	SIGNATURE_NODE,
	PARAMETER_NODE,
	STRING_NODE,
	IDENTIFIER_NODE,
	NUMBER_NODE,
	GOAL_NODE,
	SIGNATURE_SECTION_NODE,
	KB_SECTION_NODE,
	TYPE_NODE,
	RULE_NODE,
	COMPARISON_NODE,
	OPERATOR_NODE,
	TYPE_ENUM_MEMBER_NODE,
	HEADER_NODE,
	ALIAS_TYPE_NODE,
	ENUM_TYPE_NODE,
	HEADER_GOAL_NODE
}

// Base Nodes

export abstract class ASTNode {
	abstract kind: ASTNodeKind;
	range: Range;
	selectionRange: Range;

	constructor(range: Range, selectionRange: Range) {
		this.range = range;
		this.selectionRange = selectionRange;
	}

	/**
	 * Returns an {@link Iterable} over this node's child nodes if it has any.
	 */
	abstract getNodeChildren(): Iterable<ASTNode | undefined>;
}

export class UnknownNode extends ASTNode {
	kind = ASTNodeKind.UNKNOWN;

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield undefined;
	}

	constructor(range: Range) {
		super(range, range);
	}
}

export class SignatureNode extends ASTNode {
	kind = ASTNodeKind.SIGNATURE_NODE;
	name: string;
	parameters: ParameterNode[];
	signatureType?: string;

	constructor(name: string, parameters: ParameterNode[], range: Range, selectionRange: Range) {
		super(range, selectionRange);
		this.name = name;
		this.parameters = parameters;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		for (const parameter of this.parameters) {
			yield parameter;
		}
	}
}

export class ParameterNode extends ASTNode {
	kind = ASTNodeKind.PARAMETER_NODE;
	content: ASTNode;
	type?: TypeNode;
	flow?: ParameterFlow;

	constructor(content: ASTNode, range: Range, selectionRange: Range, type?: TypeNode, flow?: ParameterFlow) {
		super(range, selectionRange);
		this.content = content;
		this.type = type;
		this.flow = flow;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield this.type;
		yield this.content;
	}
}

export abstract class SingletonNode<T> extends ASTNode {
	value: T;

	constructor(value: T, range: Range) {
		super(range, range);
		this.value = value;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield undefined;
	}
}

export class StringNode extends SingletonNode<string> {
	kind = ASTNodeKind.STRING_NODE;
}

export class IdentifierNode extends SingletonNode<string> {
	kind = ASTNodeKind.IDENTIFIER_NODE;
}

export class NumberNode extends SingletonNode<number> {
	kind = ASTNodeKind.NUMBER_NODE;
}

// Goal Nodes

export class GoalNode extends ASTNode {
	kind = ASTNodeKind.GOAL_NODE;
	init: SignatureSectionNode;
	kb: KBSectionNode;
	exit: SignatureSectionNode;

	constructor(init: SignatureSectionNode, kb: KBSectionNode, exit: SignatureSectionNode, range: Range) {
		super(range, range);
		this.init = init;
		this.kb = kb;
		this.exit = exit;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield this.init;
		yield this.kb;
		yield this.exit;
	}
}

export abstract class SectionNode<T extends ASTNode> extends ASTNode {
	content: T[];

	constructor(content: T[], range: Range) {
		super(range, range);
		this.content = content;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		for (const item of this.content) {
			yield item;
		}
	}
}

export class SignatureSectionNode extends SectionNode<SignatureNode> {
	kind = ASTNodeKind.SIGNATURE_SECTION_NODE;
}

export class KBSectionNode extends SectionNode<RuleNode> {
	kind = ASTNodeKind.KB_SECTION_NODE;
}

export class TypeNode extends SingletonNode<string> {
	kind = ASTNodeKind.TYPE_NODE;
}

export class RuleNode extends ASTNode {
	kind = ASTNodeKind.RULE_NODE;
	type: string;
	call: SignatureNode;
	conditions: (SignatureNode | ComparisonNode)[];
	actions: SignatureNode[];

	constructor(
		type: string,
		call: SignatureNode,
		conditions: (SignatureNode | ComparisonNode)[],
		actions: SignatureNode[],
		range: Range,
		selectionRange: Range
	) {
		super(range, selectionRange);
		this.type = type;
		this.call = call;
		this.conditions = conditions;
		this.actions = actions;
		this.range = range;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield this.call;
		for (const condition of this.conditions) {
			yield condition;
		}
		for (const action of this.actions) {
			yield action;
		}
	}
}

export class ComparisonNode extends ASTNode {
	kind = ASTNodeKind.COMPARISON_NODE;
	left: ASTNode;
	operator: OperatorNode;
	right: ASTNode;

	constructor(left: ASTNode, operator: OperatorNode, right: ASTNode, range: Range) {
		super(range, range);
		this.left = left;
		this.operator = operator;
		this.right = right;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield this.left;
		yield this.right;
	}
}

export class OperatorNode extends SingletonNode<string> {
	kind = ASTNodeKind.OPERATOR_NODE;
}

export class TypeEnumMemberNode extends ASTNode {
	kind = ASTNodeKind.TYPE_ENUM_MEMBER_NODE;
	type: string;
	member: string;

	constructor(type: string, member: string, range: Range, selectionRange: Range) {
		super(range, selectionRange);
		this.type = type;
		this.member = member;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield undefined;
	}
}

// Header Nodes

export class HeaderNode extends ASTNode {
	kind = ASTNodeKind.HEADER_NODE;
	options: IdentifierNode[];
	types: (AliasTypeNode | EnumTypeNode)[];
	builtinSignatures: SignatureNode[];
	headerGoals: HeaderGoalNode[];
	version?: StringNode;

	constructor(
		options: IdentifierNode[],
		types: (AliasTypeNode | EnumTypeNode)[],
		builtinSignatures: SignatureNode[],
		headerGoals: HeaderGoalNode[],
		range: Range,
		version?: StringNode
	) {
		super(range, range);
		this.options = options;
		this.types = types;
		this.builtinSignatures = builtinSignatures;
		this.headerGoals = headerGoals;
		this.version = version;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		for (const option of this.options) {
			yield option;
		}
		for (const type of this.types) {
			yield type;
		}
		for (const signature of this.builtinSignatures) {
			yield signature;
		}
		for (const headerGoal of this.headerGoals) {
			yield headerGoal;
		}
	}
}

export class AliasTypeNode extends SingletonNode<string> {
	kind = ASTNodeKind.ALIAS_TYPE_NODE;
}

export class EnumTypeNode extends ASTNode {
	kind = ASTNodeKind.ENUM_TYPE_NODE;
	type: string;
	members: string[];

	constructor(type: string, members: string[], range: Range, selectionRange: Range) {
		super(range, selectionRange);
		this.type = type;
		this.members = members;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield undefined;
	}
}

export class HeaderGoalNode extends ASTNode {
	kind = ASTNodeKind.HEADER_GOAL_NODE;
	id: number;
	children: number[];
	title?: StringNode;
	init?: string;
	kb?: string;
	exit?: string;

	constructor(
		id: number,
		children: number[],
		range: Range,
		title?: StringNode,
		init?: string,
		kb?: string,
		exit?: string
	) {
		super(range, range);
		this.id = id;
		this.children = children;
		this.title = title;
		this.init = init;
		this.kb = kb;
		this.exit = exit;
	}

	*getNodeChildren(): Iterable<ASTNode | undefined> {
		yield this.title;
	}
}
