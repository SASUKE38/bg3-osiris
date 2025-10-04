import { Diagnostic } from 'vscode-languageserver';
import { 
	SignatureNode,
	ParameterNode,
	IdentifierNode,
	StringNode,
	NumberNode,
	TypeNode,
	RuleNode,
	ComparisonNode,
	OperatorNode,
	ASTNode,
	RootNode
} from '../ast/nodes';
import { Token, TokenType } from '../tokens';
import { unexpectedTokenDiagnosticFactory } from '../../diagnostics/message';

export class Parser {
	private tokens: Array<Token>;
	private pos: number = 0;
	readonly diagnostics: Array<Diagnostic> = [];

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

	consume(...expected: TokenType[]): Token {
		const token = this.peek();
		if (expected.indexOf(token.type) == -1) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory(token, ...expected));
		}
		return this.pop();
	}

	consumeIf(...expected: TokenType[]): Token {
		const token = this.peek();
		if (expected.indexOf(token.type) == -1) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory(token, ...expected));
			return token;
		} else {
			return this.pop();
		}
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
		return this.empty() || this.peek().type == type;
	}

	parseGoal(): RootNode {
		this.consume(TokenType.VERSION);
		this.consume(TokenType.INTEGER);
		this.consume(TokenType.SUBGOAL_COMBINER);
		this.consume(TokenType.IDENTIFIER);
		this.consume(TokenType.INITSECTION);
		const init = this.parseSignatureRegion(TokenType.KBSECTION);
		this.consume(TokenType.KBSECTION);
		const kb = this.parseKB();
		this.consume(TokenType.EXITSECTION);
		const exit = this.parseSignatureRegion(TokenType.ENDEXITSECTION);
		this.consume(TokenType.ENDEXITSECTION);
		this.consume(TokenType.PARENT_TARGET_EDGE);
		this.consume(TokenType.STRING);
		return {
			init: init,
			kb: kb,
			exit: exit,
			range: {
				start: {line: 0, character: 0},
				end: {
					line: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.line,
					character: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.character
				}
			}
		}
	}

	parseKB(): Array<RuleNode> {
		const body: Array<RuleNode> = [];
		while (!this.atTokenType(TokenType.EXITSECTION)) {
			if (this.expectPeek(TokenType.PROC, TokenType.QRY, TokenType.IF))
			body.push(this.parseRule());
		}
		return body;
	}

	parseSignatureRegion(endType: TokenType): Array<SignatureNode> {
		const body: Array<SignatureNode> = [];
		while (!this.atTokenType(endType)) {
			this.expectSkipUnexpected(TokenType.IDENTIFIER, TokenType.NOT);
			if (this.peek().type == TokenType.NOT) {
				this.pop();
			}
			body.push(this.parseSignature());
			this.consumeIf(TokenType.SEMICOLON);
		}
		return body;
	}

	parseRule(): RuleNode {
		const ruleStart = this.pop();
		const call = this.parseSignature();
		const conditions: Array<SignatureNode | ComparisonNode> = [];
		const actions: Array<SignatureNode> = [];
		while (!this.atTokenType(TokenType.THEN)) {
			this.consumeIf(TokenType.AND);
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

		this.consume(TokenType.THEN);
			while (this.peek().type == TokenType.IDENTIFIER) {
				actions.push(this.parseSignature());
				this.consumeIf(TokenType.SEMICOLON);
			}

		return {
			type: ruleStart.value,
			call: call,
			conditions: conditions,
			actions: actions,
			range: {
				start: ruleStart.range.start,
				end: actions.length == 0 ? ruleStart.range.end : actions[actions.length - 1].range.end
			}
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
			range: {
				start: left.range.start,
				end: right.range.end
			}
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
			case TokenType.IDENTIFIER:
				return this.parseIdentifier();
			case TokenType.GUID:
				return this.parseGUID();
			default:
				this.diagnostics.push(unexpectedTokenDiagnosticFactory(
					token, 
					TokenType.STRING,
					TokenType.INTEGER,
					TokenType.FLOAT,
					TokenType.IDENTIFIER,
					TokenType.GUID
				));
				this.pop();
				return {range: token.range};
		}
	}

	parseSignature(): SignatureNode {
		const name = this.pop();
		this.consume(TokenType.OPEN_PARENTHESIS);
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
					parameters.push({content: this.parseIdentifier(), type: type, range: parameter.range});
					if (type != null) type = null;
					break;
				case TokenType.STRING:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseString(), type: null, range: parameter.range});
					if (type != null) type = null;
					break;
				case TokenType.INTEGER:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseInteger(), type: null, range: parameter.range});
					if (type != null) type = null;
					break;
				case TokenType.FLOAT:
					if (type != null) {
						// invalid type
					}
					parameters.push({content: this.parseFloat(), type: null, range: parameter.range});
					if (type != null) type = null;
					break;
				case TokenType.GUID:
					parameters.push({content: this.parseGUID(), type: type, range: parameter.range});
					if (type != null) type = null;
					break;
				default:
					break;
			}
			if (this.peek().type != TokenType.CLOSE_PARENTHESIS) {
				this.consumeIf(TokenType.COMMA);
			}
		}
		this.consume(TokenType.CLOSE_PARENTHESIS);

		const endRange = parameters.length == 0 ? name.range.end : parameters[parameters.length - 1].range.end;
		endRange.character + 1;
		return {
			name: name.value,
			parameters: parameters,
			range: {
				start: name.range.start,
				end: endRange
			}
		}
	}

	parseIdentifier(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, range: token.range};
	}

	parseString(): StringNode {
		const token = this.pop();
		return {value: token.value, range: token.range}
	}

	parseInteger(): NumberNode {
		const token = this.pop();
		return {value: parseInt(token.value), range: token.range};
	}

	parseFloat(): NumberNode {
		const token = this.pop();
		return {value: parseFloat(token.value), range: token.range};
	}

	parseGUID(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, range: token.range};
	}
	
	parseOperator(): OperatorNode {
		const token = this.consume(
			TokenType.EQUAL,
			TokenType.NOT_EQUAL,
			TokenType.LESS_THAN,
			TokenType.LESS_THAN_OR_EQUAL,
			TokenType.GREATER_THAN,
			TokenType.GREATER_THAN_OR_EQUAL
		);
		return {operator: token.value, range: token.range};
	}

	parseType(): TypeNode | null {
		const token = this.pop();
		if (token.type != TokenType.IDENTIFIER) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory(token, TokenType.IDENTIFIER));
			if (token.type == TokenType.CLOSE_PARENTHESIS) return null;
		}
		this.consume(TokenType.CLOSE_PARENTHESIS);
		return token.type == TokenType.IDENTIFIER ? {value: token.value, range: token.range} : null;
	}
}