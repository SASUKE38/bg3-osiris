/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	SignatureNode,
	ParameterNode,
	TypeNode,
	RuleNode,
	ComparisonNode,
	GoalNode,
	SignatureSectionNode,
	KBSectionNode,
	IdentifierNode,
	StringNode,
	NumberNode,
	UnknownNode,
	ASTNode
} from "../ast/nodes";
import { Token, TokenType } from "../tokens";
import {
	expectedMessage,
	ruleMissingActionsDiagnosticFactory,
	unexpectedTokenDiagnosticFactory
} from "../../diagnostics/message";
import { ParserBase } from "./parserBase";

export class GoalParser extends ParserBase<GoalNode> {
	private parameterTypes: TokenType[] = [
		TokenType.OPEN_PARENTHESIS,
		TokenType.IDENTIFIER,
		TokenType.ENUM_MEMBER,
		TokenType.STRING,
		TokenType.INTEGER,
		TokenType.FLOAT,
		TokenType.GUID
	];
	private comparisonTypes: TokenType[] = [
		TokenType.STRING,
		TokenType.INTEGER,
		TokenType.FLOAT,
		TokenType.IDENTIFIER,
		TokenType.GUID
	];
	private headerTypes: TokenType[] = [
		TokenType.VERSION,
		TokenType.INTEGER,
		TokenType.SUBGOAL_COMBINER,
		TokenType.IDENTIFIER,
		TokenType.INITSECTION
	];
	private footerTypes: TokenType[] = [TokenType.ENDEXITSECTION, TokenType.PARENT_TARGET_EDGE, TokenType.STRING];
	private operatorTypes: TokenType[] = [
		TokenType.EQUAL,
		TokenType.NOT_EQUAL,
		TokenType.LESS_THAN,
		TokenType.LESS_THAN_OR_EQUAL,
		TokenType.GREATER_THAN,
		TokenType.GREATER_THAN_OR_EQUAL
	];

	parse(): GoalNode {
		this.consumeSequence({ expectedType: this.headerTypes });
		const init = this.parseSignatureSection(TokenType.KBSECTION);
		// this.consume({ expectedType: [TokenType.KBSECTION] });
		const kb = this.parseKBSection();
		this.consume({ expectedType: [TokenType.EXITSECTION] });
		const exit = this.parseSignatureSection(TokenType.ENDEXITSECTION);
		this.consumeSequence({ expectedType: this.footerTypes });
		return new GoalNode(init, kb, exit, this.getTokenRange());
	}

	private parseKBSection(): KBSectionNode {
		const body: RuleNode[] = [];
		const sectionStart = this.peek();
		while (!this.atTokenType(TokenType.EXITSECTION)) {
			if (this.consumeUnexpected({ expectedType: [TokenType.PROC, TokenType.QRY, TokenType.IF] }).matched) {
				body.push(this.parseRule());
			}
		}
		return new KBSectionNode(body, {
			start: sectionStart.range.start,
			end: body.length > 1 ? body[body.length - 1].range.end : sectionStart.range.end
		});
	}

	private parseSignatureSection(endType: TokenType): SignatureSectionNode {
		const body: SignatureNode[] = [];
		const sectionStart = this.peek();
		while (!this.atTokenType(endType)) {
			if (this.consumeUnexpected({ expectedType: [TokenType.IDENTIFIER, TokenType.NOT] }).matched) {
				if (this.peek().type == TokenType.NOT) {
					this.pop();
				}
				body.push(this.parseSignature(false));
				this.consumeIf({ expectedType: [TokenType.SEMICOLON] });
			}
		}
		return new SignatureSectionNode(body, {
			start: sectionStart.range.start,
			end: body.length > 1 ? body[body.length - 1].range.end : sectionStart.range.end
		});
	}

	private parseRule(): RuleNode {
		const ruleStart = this.pop();
		const call = this.parseSignature();
		const conditions: (SignatureNode | ComparisonNode)[] = [];
		const actions: SignatureNode[] = [];
		while (!this.atTokenType(TokenType.THEN)) {
			if (!this.consume({ expectedMessage: expectedMessage.andOrThen, expectedType: [TokenType.AND] }).matched)
				continue;
			const currentType = this.peek().type;
			if (currentType == TokenType.NOT || (currentType == TokenType.IDENTIFIER && this.peek().value[0] != "_")) {
				if (currentType == TokenType.NOT) {
					this.pop();
				}
				conditions.push(this.parseSignature());
			} else if (
				[TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT, TokenType.IDENTIFIER, TokenType.GUID].indexOf(
					currentType
				) != -1
			) {
				conditions.push(this.parseComparison());
			} else {
				const token = this.pop();
				this.diagnostics.push(
					unexpectedTokenDiagnosticFactory({
						actualToken: token,
						expectedMessage: expectedMessage.signatureOrComparison
					})
				);
			}
		}

		this.consume({ expectedType: [TokenType.THEN] });
		while (this.peek().type == TokenType.IDENTIFIER || this.peek().type == TokenType.NOT) {
			if (this.peek().type == TokenType.NOT) {
				this.pop();
			}
			actions.push(this.parseSignature());
			this.consumeIf({ expectedType: [TokenType.SEMICOLON] });
		}
		if (actions.length == 0) this.diagnostics.push(ruleMissingActionsDiagnosticFactory({ rule: ruleStart }));

		return new RuleNode(
			ruleStart.value,
			call,
			conditions,
			actions,
			{
				start: ruleStart.range.start,
				end: actions.length == 0 ? ruleStart.range.end : actions[actions.length - 1].range.end
			},
			{
				start: ruleStart.range.start,
				end: ruleStart.range.end
			}
		);
	}

	private parseComparison(): ComparisonNode {
		const left = this.parseComparisonOperand();
		const operator = this.parseOperator(this.operatorTypes);
		const right = this.parseComparisonOperand();

		return new ComparisonNode(left, operator, right, {
			start: left.range.start,
			end: right.range.end
		});
	}

	private parseComparisonOperand(): StringNode | NumberNode | IdentifierNode | UnknownNode {
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
				this.diagnostics.push(
					unexpectedTokenDiagnosticFactory({
						actualToken: token,
						expectedType: this.comparisonTypes
					})
				);
				this.pop();
				return new UnknownNode(token.range);
		}
	}

	private parseSignature(allowIdentifiers = true): SignatureNode {
		const name = this.pop();
		this.consume({ expectedType: [TokenType.OPEN_PARENTHESIS] });
		const parameters: ParameterNode[] = [];
		let type = undefined;
		let requireParameter = false;
		while (!this.atTokenType(TokenType.CLOSE_PARENTHESIS)) {
			if (
				this.consumeUnexpected({
					expectedMessage: expectedMessage.parameter,
					expectedType: this.parameterTypes
				}).matched
			) {
				const parameter = this.peek();
				let parameterSubNode: ASTNode;
				switch (parameter.type) {
					case TokenType.OPEN_PARENTHESIS:
						this.pop();
						type = this.parseType();
						continue;
					case TokenType.IDENTIFIER:
						if (!allowIdentifiers) {
							this.diagnostics.push(
								unexpectedTokenDiagnosticFactory({
									actualToken: parameter,
									expectedType: [TokenType.GUID, TokenType.STRING, TokenType.INTEGER, TokenType.FLOAT]
								})
							);
						}
						parameterSubNode = this.parseIdentifier();
						break;
					case TokenType.ENUM_MEMBER:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameterSubNode = this.parseTypeEnumMember();
						break;
					case TokenType.STRING:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameterSubNode = this.parseString();
						break;
					case TokenType.INTEGER:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameterSubNode = this.parseInteger();
						break;
					case TokenType.FLOAT:
						this.verifyNoType(parameter, type, allowIdentifiers);
						parameterSubNode = this.parseFloat();
						break;
					case TokenType.GUID:
						parameterSubNode = this.parseGUID();
						break;
				}
				parameters.push(
					new ParameterNode(
						parameterSubNode!,
						type ? { start: type.range.start, end: parameter.range.end } : parameter.range,
						{ start: parameter.range.start, end: parameter.range.end },
						type
					)
				);
				type = undefined;
				requireParameter = false;
				if (this.peek().type != TokenType.CLOSE_PARENTHESIS) {
					this.consumeIf({ expectedType: [TokenType.COMMA] });
					requireParameter = true;
				}
			}
		}
		if (requireParameter || type) {
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({
					actualToken: this.peek(),
					expectedMessage: expectedMessage.parameter
				})
			);
		}
		this.consume({ expectedType: [TokenType.CLOSE_PARENTHESIS] });

		return new SignatureNode(
			name.value,
			parameters,
			{
				start: name.range.start,
				end: {
					line:
						parameters.length == 0 ? name.range.end.line : parameters[parameters.length - 1].range.end.line,
					character:
						parameters.length == 0
							? name.range.end.character + 2
							: parameters[parameters.length - 1].range.end.character + 1
				}
			},
			{
				start: name.range.start,
				end: name.range.end
			}
		);
	}

	private verifyNoType(parameter: Token, type?: TypeNode, allowIdentifiers = true) {
		if (type != null) {
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({
					actualToken: parameter,
					expectedType: allowIdentifiers ? [TokenType.GUID, TokenType.IDENTIFIER] : [TokenType.GUID]
				})
			);
		}
	}
}
