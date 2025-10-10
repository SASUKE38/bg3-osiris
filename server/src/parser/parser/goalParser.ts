import { Diagnostic } from 'vscode-languageserver';
import { 
	SignatureNode,
	ParameterNode,
	TypeNode,
	RuleNode,
	ComparisonNode,
	ASTNode,
	GoalNode
} from '../ast/nodes';
import { Token, TokenType } from '../tokens';
import { expectedMessage, ruleMissingActionsDiagnosticFactory, unexpectedTokenDiagnosticFactory } from '../../diagnostics/message';
import { ParserBase } from './parserBase';

export class GoalParser extends ParserBase<GoalNode> {
	private parameterTypes: Array<TokenType> = [TokenType.OPEN_PARENTHESIS, TokenType.IDENTIFIER, TokenType.ENUM_MEMBER, TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.GUID];
	private comparisonTypes: Array<TokenType> = [TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.IDENTIFIER, TokenType.GUID];
	private headerTypes: Array<TokenType> = [TokenType.VERSION, TokenType.INTEGER, TokenType.SUBGOAL_COMBINER, TokenType.IDENTIFIER, TokenType.INITSECTION];
	private footerTypes: Array<TokenType> = [TokenType.ENDEXITSECTION, TokenType.PARENT_TARGET_EDGE, TokenType.STRING];
	private operatorTypes: Array<TokenType> = [TokenType.EQUAL, TokenType.NOT_EQUAL, TokenType.LESS_THAN, TokenType.LESS_THAN_OR_EQUAL, TokenType.GREATER_THAN, TokenType.GREATER_THAN_OR_EQUAL];
	readonly diagnostics: Array<Diagnostic> = [];

	constructor(tokens: Array<Token>) {
		super(tokens);
	}

	parse(): GoalNode {
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
		const operator = this.parseOperator(this.operatorTypes);
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
					case TokenType.ENUM_MEMBER:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameters.push({content: this.parseTypeEnumMember(), type: null, range: parameter.range})
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
}