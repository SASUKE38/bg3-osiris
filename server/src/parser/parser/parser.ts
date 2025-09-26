import { SignatureNode, ParameterNode, IdentifierNode, StringNode, NumberNode, TypeNode, RuleNode, ComparisonNode, OperatorNode, ASTNode, RootNode } from '../ast/nodes';
import { Token, TokenType } from '../tokens';

export class Parser {
	private tokens: Array<Token>;
	private pos: number = 0;

	constructor(tokens: Array<Token>) {
		this.tokens = tokens;
	}

	peek(): Token {
		return this.tokens[this.pos];
	}

	pop(): Token {
		const token = this.peek();
		this.pos++;
		return token;
	}

	empty(): boolean {
		return this.pos >= this.tokens.length || this.peek().type == TokenType.EOF;
	}

	expect(...expected: TokenType[]): Token {
		const token = this.peek();
		if (expected.indexOf(token.type) == -1) {
			console.log(`Expected ${expected} but received ${token.value}.`);
		}
		return this.pop();
	}

	expectPeek(...expected: TokenType[]): boolean {
		const token = this.peek();
		if (expected.indexOf(token.type) == -1) {
			console.log(`Expected ${expected} but received ${token.value}.`);
			return false;
		}
		return true;
	}

	expectSkipUnexpected(...expected: TokenType[]) {
		const token = this.peek();
		if (expected.indexOf(token.type) == -1) {
			this.pop();
			console.log(`Expected ${expected} but received ${token.value}.`);
		}
	}

	atTokenType(type: TokenType) {
		return this.peek().type == type || this.empty();
	}

	parseGoal(): RootNode {
		this.expect(TokenType.VERSION);
		this.expect(TokenType.INTEGER);
		this.expect(TokenType.SUBGOAL_COMBINER);
		this.expect(TokenType.IDENTIFIER);
		this.expect(TokenType.INITSECTION);
		const init = this.parseInit();
		this.expect(TokenType.KBSECTION);
		const kb = this.parseKB();
		// this.expect(TokenType.EXITSECTION);
		// body.push(this.parseExit());
		// this.expect(TokenType.ENDEXITSECTION);
		// this.expect(TokenType.PARENT_TARGET_EDGE);
		// this.expect(TokenType.STRING);
		return {
			init: init,
			kb: kb,
			exit: [],
			line: 0,
			col: 0
		}
	}

	parseInit(): Array<SignatureNode> {
		const body: Array<SignatureNode> = [];
		while (!this.atTokenType(TokenType.KBSECTION)) {
			this.expectSkipUnexpected(TokenType.IDENTIFIER);
			body.push(this.parseSignature());
			this.expect(TokenType.SEMICOLON);
		}
		return body;
	}

	parseKB(): Array<RuleNode> {
		const body: Array<RuleNode> = [];
		while (!this.atTokenType(TokenType.EXITSECTION)) {
			if (this.expectPeek(TokenType.PROC, TokenType.QRY, TokenType.IF))
			body.push(this.parseRule());
		}
		return body;
	}

	parseExit() {

	}

	parseRule(): RuleNode {
		const ruleStart = this.pop();
		const call = this.parseSignature();
		const conditions: Array<SignatureNode | ComparisonNode> = [];
		const actions: Array<SignatureNode> = [];
		while (!this.atTokenType(TokenType.THEN)) {
			this.expect(TokenType.AND);
			const currentType = this.peek().type;
			if (currentType == TokenType.NOT) {
				this.pop();
				conditions.push(this.parseSignature());
			} else if (currentType == TokenType.IDENTIFIER && this.peek().value[0] != "_") {
				conditions.push(this.parseSignature());
			} else {
				conditions.push(this.parseComparison());
			}
		}

		this.expect(TokenType.THEN);
			while (this.peek().type == TokenType.IDENTIFIER) {
				actions.push(this.parseSignature());
				this.expect(TokenType.SEMICOLON);
			}

		return {
			type: ruleStart.value,
			call: call,
			conditions: conditions,
			actions: actions,
			line: ruleStart.line,
			col: ruleStart.col
		}
	}

	parseComparison(): ComparisonNode {
		const left = this.parseComparisonOperand();
		const operator = this.parseOperator();
		const right = this.parseComparisonOperand();
		return {
			left: left,
			operator: operator,
			right: right,
			line: left.line,
			col: left.col
		}
	}

	parseComparisonOperand(): ASTNode {
		const token = this.peek();
		switch (token.type) {
			case TokenType.STRING:
				return this.parseString();
			case TokenType.INTEGER:
				return this.parseInteger();
			case TokenType.FLOAT:
				return this.parseFloat();
			default:
				return this.parseIdentifier();
		}
	}

	parseSignature(): SignatureNode {
		const name = this.pop();
		this.expect(TokenType.OPEN_PARENTHESIS);
		const parameters: Array<ParameterNode> = []
		let type = null;
		while (!this.atTokenType(TokenType.CLOSE_PARENTHESIS)) {
			if (!this.expectPeek(TokenType.OPEN_PARENTHESIS, TokenType.IDENTIFIER, TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.GUID)) {
				break;
			}
			const parameter = this.peek();
			switch (parameter.type) {
				case TokenType.OPEN_PARENTHESIS:
					this.pop();
					type = this.parseType();
					continue;
				case TokenType.IDENTIFIER:
					parameters.push({content: this.parseIdentifier(), type: type, line: parameter.line, col: parameter.col});
					if (type != null) type = null;
					break;
				case TokenType.STRING:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseString(), type: null, line: parameter.line, col: parameter.col});
					if (type != null) type = null;
					break;
				case TokenType.INTEGER:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseInteger(), type: null, line: parameter.line, col: parameter.col});
					if (type != null) type = null;
					break;
				case TokenType.FLOAT:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseFloat(), type: null, line: parameter.line, col: parameter.col});
					if (type != null) type = null;
					break;
				case TokenType.GUID:
					parameters.push({content: this.parseGUID(), type: type, line: parameter.line, col: parameter.col});
					if (type != null) type = null;
					break;
				default:
					break;
			}
			if (this.peek().type != TokenType.CLOSE_PARENTHESIS) {
				this.expect(TokenType.COMMA);
			}
		}
		this.expect(TokenType.CLOSE_PARENTHESIS);
		return {
			name: name.value,
			parameters: parameters,
			line: name.line,
			col: name.col
		}
	}

	parseIdentifier(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, line: token.line, col: token.col};
	}

	parseString(): StringNode {
		const token = this.pop();
		return {value: token.value, line: token.line, col: token.col}
	}

	parseInteger(): NumberNode {
		const token = this.pop();
		return {value: parseInt(token.value), line: token.line, col: token.col};
	}

	parseFloat(): NumberNode {
		const token = this.pop();
		return {value: parseFloat(token.value), line: token.line, col: token.col};
	}

	parseGUID(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, line: token.line, col: token.col};
	}
	
	parseOperator(): OperatorNode {
		const token = this.pop();
		return {operator: token.value, line: token.line, col: token.col};
	}

	parseType(): TypeNode {
		this.expectPeek(TokenType.IDENTIFIER);
		const token = this.pop();
		this.expect(TokenType.CLOSE_PARENTHESIS)
		return {value: token.value, line: token.line, col: token.col}
	}
}