import { expectedMessage, unexpectedTokenDiagnosticFactory } from '../../diagnostics/message';
import { AliasTypeNode, EnumTypeNode, HeaderGoalNode, HeaderNode, IdentifierNode, ParameterFlow, ParameterNode, SignatureNode, StringNode } from '../ast/nodes';
import { TokenType } from '../tokens';
import { ParserBase } from './parserBase';

export class HeaderParser extends ParserBase<HeaderNode> {
	private optionLabels: string[] = ["option"];
	private typeLabels: string[] = ["alias_type", "enum_type"];
	private builtinLabels: string[] = ["syscall", "sysquery", "query", "call", "event"]; 
	private builtinTypes: TokenType[] = [TokenType.OPEN_BRACKET, TokenType.OPEN_PARENTHESIS, TokenType.IDENTIFIER];

	parse(): HeaderNode {
		const options: IdentifierNode[] = [];
		const types: (AliasTypeNode | EnumTypeNode)[] = [];
		const builtinSignatures: SignatureNode[] = [];
		let version: StringNode | null = null;
		const headerGoals: HeaderGoalNode[] = [];
		while (!this.empty()) {
			const label = this.peek().value;
			if (this.optionLabels.indexOf(label) != -1) {
				this.pop();
				options.push(this.parseIdentifier());
			} else if (this.typeLabels.indexOf(label) != -1) {
				types.push(this.parseHeaderType());
			} else if (this.builtinLabels.indexOf(label) != -1) {
				builtinSignatures.push(this.parseBuiltin());
			} else if (label == "version") {
				this.pop();
				version = this.parseString();
			} else if (label == "Goal") {
				this.parseGoalElement(headerGoals);
			} else {
				this.pop();
			}
		}
		return {
			options,
			types,
			builtinSignatures,
			version,
			headerGoals,
			range: this.getTokenRange()
		}
	}

	private parseHeaderType(): AliasTypeNode | EnumTypeNode {
		return this.peek().value == "alias_type" ? this.parseAliasType() : this.parseEnumType();
	}

	private parseAliasType(): AliasTypeNode {
		const startRange = this.pop().range;
		this.consume({expectedType: [TokenType.OPEN_BRACE]});
		const type = this.parseIdentifier().symbol;
		while (!this.atTokenType(TokenType.CLOSE_BRACE)) this.pop();
		const endToken = this.consume({expectedType: [TokenType.CLOSE_BRACE]}).token;
		return {
			type,
			range: {
				start: startRange.start,
				end: endToken.range.end
			}
		}
	}

	private parseEnumType(): EnumTypeNode {
		const startRange = this.pop().range;
		this.consume({expectedType: [TokenType.OPEN_BRACE]});
		const type = this.parseIdentifier().symbol;
		const members: string[] = [];
		let token;
		while (!this.atTokenType(TokenType.CLOSE_BRACE)) {
			token = this.pop();
			if (token.type == TokenType.IDENTIFIER) {
				const member = token.value;
				this.consume({expectedType: [TokenType.ENUM_ASSIGNMENT]});
				this.consume({expectedType: [TokenType.INTEGER]});
				members.push(member);
			}
		}
		const endToken = this.consume({expectedType: [TokenType.CLOSE_BRACE]}).token;
		return {
			type,
			members,
			range: {
				start: startRange.start,
				end: endToken.range.end
			}
		}
	}

	private parseBuiltin(): SignatureNode {
		const signatureType = this.pop();
		const signatureName = this.consume({expectedType: [TokenType.IDENTIFIER]});
		this.consume({expectedType: [TokenType.OPEN_PARENTHESIS]});
		const parameters: ParameterNode[] = [];
		let type = null;
		let flow = null;
		let requireParameter = false;
		while (!this.atTokenType(TokenType.CLOSE_PARENTHESIS)) {
			if (this.consumeUnexpected({expectedType: this.builtinTypes}).matched) {
				const parameter = this.peek();
				switch (parameter.type) {
					case TokenType.OPEN_BRACKET:
						this.pop();
						flow = this.parseFlow();
						continue;
					break;
					case TokenType.OPEN_PARENTHESIS:
						this.pop();
						type = this.parseType();
						continue;
					break;
					case TokenType.IDENTIFIER:
						parameters.push({content: this.parseIdentifier(), type: type, flow: flow, range: parameter.range})
					break;
				}
				requireParameter = false;
				type = null;
				flow = null;
				
				if (this.peek().type != TokenType.CLOSE_PARENTHESIS) {
					this.consumeIf({expectedType: [TokenType.COMMA]});
					requireParameter = true;
				}
			}
		}

		if (requireParameter || type || flow) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({
				actualToken: this.peek(),
				expectedMessage: expectedMessage.parameter
			}));
		}
		this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});

		if (this.peek().type == TokenType.OPEN_PARENTHESIS) {
			while (!this.atTokenType(TokenType.CLOSE_PARENTHESIS)) this.pop();
			this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
		}

		return {
			signatureType: signatureType.value,
			name: signatureName.token.value,
			parameters: parameters,
			range: {
				start: signatureType.range.start,
				end: {
					line: parameters.length == 0 ? signatureName.token.range.end.line : parameters[parameters.length - 1].range.end.line,
					character: parameters.length == 0 ? signatureName.token.range.end.character + 2 : parameters[parameters.length - 1].range.end.character + 1,
				}
			}
		};
	}

	private parseGoalElement(goals: HeaderGoalNode[]) {
		const startToken = this.pop();
		this.consume({expectedType: [TokenType.OPEN_PARENTHESIS]});
		if (this.peek().type != TokenType.INTEGER) return;
		const id = parseInt(this.pop().value);
		this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
		let goal = goals.find((goal) => goal.id === id);
		if (!goal) {
			goal = {
				id,
				children: [],
				range: startToken.range
			};
			goals.push(goal);
		}
		if (this.peek().type == TokenType.PERIOD) {
			this.consume({expectedType: [TokenType.PERIOD]});
			if (this.peek().type != TokenType.IDENTIFIER) return;
			const operation = this.pop().value;
			if (operation == "Title") {
				this.consume({expectedType: [TokenType.OPEN_PARENTHESIS]});
				if (this.peek().type != TokenType.STRING) return;
				goal.title = this.parseString();
				this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
				this.consume({expectedType: [TokenType.SEMICOLON]});
			} else if (operation == "SubGoal") {
				this.consume({expectedType: [TokenType.OPEN_PARENTHESIS]});
				if (this.peek().type == TokenType.AND) {
					this.pop();
				} else if (this.peek().type == TokenType.INTEGER) {
					goal.children.push(parseInt(this.pop().value));
				}
				this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
				this.consume({expectedType: [TokenType.SEMICOLON]});
			} else {
				return;
			}
		} else if (this.peek().type == TokenType.OPEN_BRACE) {
			this.consume({expectedType: [TokenType.OPEN_BRACE]});
			const init = this.consume({expectedType: [TokenType.INIT]});
			const kb = this.consume({expectedType: [TokenType.KB]});
			const exit = this.consume({expectedType: [TokenType.EXIT]});
			if (init.matched) goal.init = init.token.value;
			if (kb.matched) goal.kb = kb.token.value;
			if (exit.matched) goal.exit = exit.token.value;
			this.consume({expectedType: [TokenType.CLOSE_BRACE]});
		}
	}

	private parseFlow(): ParameterFlow | null {
		const token = this.pop();
		if (token.type != TokenType.IDENTIFIER || !(token.value == "in" || token.value == "out")) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage: expectedMessage.flow}));
			if (token.type == TokenType.CLOSE_BRACKET) return null;
		}
		this.consume({expectedType: [TokenType.CLOSE_BRACKET]});
		return token.value == "in" ? ParameterFlow.IN : ParameterFlow.OUT;
	}
}