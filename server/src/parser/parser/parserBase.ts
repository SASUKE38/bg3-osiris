import { Diagnostic, Range } from "vscode-languageserver";
import { IdentifierNode, StringNode, NumberNode, TypeNode, OperatorNode, TypeEnumMemberNode } from "../ast/nodes";
import { Token, TokenType } from "../tokens";
import { expectedMessage, unexpectedTokenDiagnosticFactory } from "../../diagnostics/message";

interface ConsumeParams {
	expectedType: TokenType[];
	expectedMessage?: string;
}

interface ConsumeResult {
	token: Token;
	matched?: boolean;
}

export abstract class ParserBase<T> {
	protected tokens: Token[];
	protected pos = 0;
	readonly diagnostics: Diagnostic[] = [];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	protected peek(): Token {
		return this.pos >= this.tokens.length
			? {
					type: TokenType.EOF,
					value: "EOF",
					range:
						this.tokens.length > 0
							? this.tokens[this.tokens.length - 1].range
							: {
									start: { line: 0, character: 0 },
									end: { line: 0, character: 0 }
								}
				}
			: this.tokens[this.pos];
	}

	protected pop(): Token {
		const token = this.peek();
		if (!this.empty()) this.pos++;
		return token;
	}

	protected empty(): boolean {
		return this.pos >= this.tokens.length || this.peek().type == TokenType.EOF;
	}

	protected atTokenType(type: TokenType) {
		return this.empty() || this.peek().type == type;
	}

	protected consume({ expectedMessage, expectedType }: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({ actualToken: token, expectedMessage, expectedType })
			);
		}
		return { matched, token: this.pop() };
	}

	protected consumeIf({ expectedMessage, expectedType }: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({ actualToken: token, expectedMessage, expectedType })
			);
			return { matched, token };
		} else {
			return { matched, token: this.pop() };
		}
	}

	protected consumeUnexpected({ expectedMessage, expectedType }: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({ actualToken: token, expectedMessage, expectedType })
			);
			this.pop();
		}
		return { matched, token };
	}

	protected consumeSequence({ expectedMessage, expectedType }: ConsumeParams) {
		for (const type of expectedType) {
			this.consume({ expectedMessage, expectedType: [type] });
		}
	}

	protected parseIdentifier(): IdentifierNode {
		const token = this.pop();
		return new IdentifierNode(token.value, token.range);
	}

	protected parseString(): StringNode {
		const token = this.pop();
		return new StringNode(token.value, token.range);
	}

	protected parseInteger(): NumberNode {
		const token = this.pop();
		return new NumberNode(parseInt(token.value), token.range);
	}

	protected parseFloat(): NumberNode {
		const token = this.pop();
		return new NumberNode(parseFloat(token.value), token.range);
	}

	protected parseGUID(): IdentifierNode {
		return this.parseIdentifier();
	}

	protected parseOperator(expectedTypes: TokenType[]): OperatorNode {
		const token = this.consume({
			expectedMessage: expectedMessage.operator,
			expectedType: expectedTypes
		}).token;
		return new OperatorNode(token.value, token.range);
	}

	protected parseType(): TypeNode | undefined {
		const token = this.pop();
		if (token.type != TokenType.IDENTIFIER) {
			this.diagnostics.push(
				unexpectedTokenDiagnosticFactory({ actualToken: token, expectedMessage: expectedMessage.type })
			);
			if (token.type == TokenType.CLOSE_PARENTHESIS) return undefined;
		}
		this.consume({ expectedType: [TokenType.CLOSE_PARENTHESIS] });
		return token.type == TokenType.IDENTIFIER ? new TypeNode(token.value, token.range) : undefined;
	}

	protected parseTypeEnumMember(): TypeEnumMemberNode {
		const token = this.pop();
		const parts = token.value.split(".", 2);
		return new TypeEnumMemberNode(parts[0], parts[1], token.range);
	}

	protected getTokenRange(): Range {
		return {
			start: { line: 0, character: 0 },
			end: {
				line: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.line,
				character: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.character
			}
		};
	}

	abstract parse(): T;
}
