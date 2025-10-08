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
import { expectedMessage, ruleMissingActionsDiagnosticFactory, unexpectedTokenDiagnosticFactory } from '../../diagnostics/message';

type ConsumeParams = {
	expectedType: Array<TokenType>
	expectedMessage?: string
}

type ConsumeResult = {
	token: Token
	matched?: boolean
}

export class Parser {
	private tokens: Array<Token>;
	private pos: number = 0;
	private parameterTypes: Array<TokenType> = [TokenType.OPEN_PARENTHESIS, TokenType.IDENTIFIER, TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.GUID];
	private comparisonTypes: Array<TokenType> = [TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.IDENTIFIER, TokenType.GUID];
	private headerTypes: Array<TokenType> = [TokenType.VERSION, TokenType.INTEGER, TokenType.SUBGOAL_COMBINER, TokenType.IDENTIFIER, TokenType.INITSECTION];
	private footerTypes: Array<TokenType> = [TokenType.ENDEXITSECTION, TokenType.PARENT_TARGET_EDGE, TokenType.STRING];
	private operatorTypes: Array<TokenType> = [TokenType.EQUAL, TokenType.NOT_EQUAL, TokenType.LESS_THAN, TokenType.LESS_THAN_OR_EQUAL, TokenType.GREATER_THAN, TokenType.GREATER_THAN_OR_EQUAL];
	readonly diagnostics: Array<Diagnostic> = [];

	constructor(tokens: Array<Token>) {
		this.tokens = tokens;
	}

	peek(): Token {
		return this.pos >= this.tokens.length ? {
			type: TokenType.EOF,
			value: "EOF",
			range: this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].range : {
				start: {line: 0, character: 0},
				end: {line: 0, character: 0}
			}
		} : this.tokens[this.pos];
	}

	pop(): Token {
		const token = this.peek();
		if (!this.empty()) this.pos++;
		return token;
	}

	empty(): boolean {
		return this.pos >= this.tokens.length || this.peek().type == TokenType.EOF;
	}

	atTokenType(type: TokenType) {
		return this.empty() || this.peek().type == type;
	}

	consume({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage, expectedType}));
		}
		return {matched, token: this.pop()};
	}

	consumeIf({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage, expectedType}));
			return {matched, token};
		} else {
			return {matched, token: this.pop()};
		}
	}

	consumeUnexpected({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage, expectedType}));
			this.pop();
		}
		return {matched, token};
	}

	consumeSequence({expectedMessage, expectedType}: ConsumeParams) {
		for (const type of expectedType) {
			this.consume({expectedMessage, expectedType: [type]});
		} 
	}

	parseGoal(): RootNode {
		this.consumeSequence({expectedType: this.headerTypes});
		const init = this.parseSignatureRegion(TokenType.KBSECTION);
		this.consume({expectedType: [TokenType.KBSECTION]});
		const kb = this.parseKB();
		this.consume({expectedType: [TokenType.EXITSECTION]});
		const exit = this.parseSignatureRegion(TokenType.ENDEXITSECTION);
		this.consumeSequence({expectedType: this.footerTypes});
		return {
			init,
			kb,
			exit,
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
			if (this.consumeUnexpected({expectedType: [TokenType.PROC, TokenType.QRY, TokenType.IF]}).matched) {
				body.push(this.parseRule());
			}
		}
		return body;
	}

	parseSignatureRegion(endType: TokenType): Array<SignatureNode> {
		const body: Array<SignatureNode> = [];
		while (!this.atTokenType(endType)) {
			if (this.consumeUnexpected({expectedType: [TokenType.IDENTIFIER, TokenType.NOT]}).matched) {
				if (this.peek().type == TokenType.NOT) {
					this.pop();
				}
				body.push(this.parseSignature(false));
				this.consumeIf({expectedType: [TokenType.SEMICOLON]});
			}
		}
		return body;
	}

	parseRule(): RuleNode {
		const ruleStart = this.pop();
		const call = this.parseSignature();
		const conditions: Array<SignatureNode | ComparisonNode> = [];
		const actions: Array<SignatureNode> = [];
		while (!this.atTokenType(TokenType.THEN)) {
			if (!this.consume({expectedMessage: expectedMessage.andOrThen, expectedType: [TokenType.AND]}).matched) continue;
			const currentType = this.peek().type;
			if (currentType == TokenType.NOT || (currentType == TokenType.IDENTIFIER && this.peek().value[0] != "_")) {
				if (currentType == TokenType.NOT) {
					this.pop();
				}
				conditions.push(this.parseSignature());
			} else if (([TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.IDENTIFIER, TokenType.GUID].indexOf(currentType) != -1)) {
				conditions.push(this.parseComparison());
			} else {
				const token = this.pop();
				this.diagnostics.push(unexpectedTokenDiagnosticFactory({
					actualToken: token,
					expectedMessage: expectedMessage.signatureOrComparison
				}));
			}
		}

		this.consume({expectedType: [TokenType.THEN]});
		while (this.peek().type == TokenType.IDENTIFIER) {
			actions.push(this.parseSignature());
			this.consumeIf({expectedType: [TokenType.SEMICOLON]});
		}
		if (actions.length == 0) this.diagnostics.push(ruleMissingActionsDiagnosticFactory({rule: ruleStart}));

		return {
			type: ruleStart.value,
			call,
			conditions,
			actions,
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
			left,
			operator,
			right,
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
				this.diagnostics.push(unexpectedTokenDiagnosticFactory({
					actualToken: token,
					expectedType: this.comparisonTypes
				}));
				this.pop();
				return {range: token.range};
		}
	}
	
	parseSignature(allowIdentifiers=true): SignatureNode {
		const name = this.pop();
		this.consume({expectedType: [TokenType.OPEN_PARENTHESIS]});
		const parameters: Array<ParameterNode> = [];
		let type = null;
		let requireParameter = false;
		while (!this.atTokenType(TokenType.CLOSE_PARENTHESIS)) {
			if (this.consumeUnexpected({expectedMessage: expectedMessage.parameter, expectedType: this.parameterTypes}).matched) {
				const parameter = this.peek();
				switch (parameter.type) {
					case TokenType.OPEN_PARENTHESIS:
						this.pop();
						type = this.parseType();
						continue;
					case TokenType.IDENTIFIER:
						if (!allowIdentifiers) {
							this.diagnostics.push(unexpectedTokenDiagnosticFactory({
								actualToken: parameter,
								expectedType: [TokenType.GUID, TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT]
							}));
						}
						parameters.push({content: this.parseIdentifier(), type: type, range: parameter.range});
						if (type != null) type = null;
						break;
					case TokenType.STRING:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameters.push({content: this.parseString(), type: null, range: parameter.range});
						if (type != null) type = null;
						break;
					case TokenType.INTEGER:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameters.push({content: this.parseInteger(), type: null, range: parameter.range});
						if (type != null) type = null;
						break;
					case TokenType.FLOAT:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameters.push({content: this.parseFloat(), type: null, range: parameter.range});
						if (type != null) type = null;
						break;
					case TokenType.GUID:
						parameters.push({content: this.parseGUID(), type: type, range: parameter.range});
						if (type != null) type = null;
						break;
					default:
						this.diagnostics.push(unexpectedTokenDiagnosticFactory({
							actualToken: parameter
						}));
						break;
				}
				requireParameter = false;
				if (this.peek().type != TokenType.CLOSE_PARENTHESIS) {
					this.consumeIf({expectedType: [TokenType.COMMA]});
					requireParameter = true;
				}
			}
		}
		if (requireParameter || type) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({
				actualToken: this.peek(),
				expectedMessage: expectedMessage.parameter
			}));
		}
		this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});

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

	verifyNoType(parameter: Token, type: TypeNode | null, allowIdentifiers=true) {
		if (type != null) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({
				actualToken: parameter,
				expectedType: allowIdentifiers ? [TokenType.GUID, TokenType.IDENTIFIER] : [TokenType.GUID]
			}));
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
		const token = this.consume({
			expectedMessage: expectedMessage.operator,
			expectedType: this.operatorTypes
		}).token;
		return {operator: token.value, range: token.range};
	}

	parseType(): TypeNode | null {
		const token = this.pop();
		if (token.type != TokenType.IDENTIFIER) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage: expectedMessage.type}));
			if (token.type == TokenType.CLOSE_PARENTHESIS) return null;
		}
		this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
		return token.type == TokenType.IDENTIFIER ? {value: token.value, range: token.range} : null;
	}
}