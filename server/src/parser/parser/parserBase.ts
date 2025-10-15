import { Diagnostic, Range } from 'vscode-languageserver';
import {
	IdentifierNode,
	StringNode,
	NumberNode,
	TypeNode,
	OperatorNode,
	TypeEnumMemberNode
} from '../ast/nodes';
import { Token, TokenType } from '../tokens';
import { expectedMessage, unexpectedTokenDiagnosticFactory } from '../../diagnostics/message';

type ConsumeParams = {
	expectedType: Array<TokenType>
	expectedMessage?: string
}

type ConsumeResult = {
	token: Token
	matched?: boolean
}

export abstract class ParserBase<T> {
	protected tokens: Array<Token>;
	protected pos: number = 0;
	readonly diagnostics: Array<Diagnostic> = [];

	constructor(tokens: Array<Token>) {
		this.tokens = tokens;
	}

	protected peek(): Token {
		return this.pos >= this.tokens.length ? {
			type: TokenType.EOF,
			value: "EOF",
			range: this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].range : {
				start: {line: 0, character: 0},
				end: {line: 0, character: 0}
			}
		} : this.tokens[this.pos];
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

	protected consume({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage, expectedType}));
		}
		return {matched, token: this.pop()};
	}

	protected consumeIf({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
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

	protected consumeUnexpected({expectedMessage, expectedType}: ConsumeParams): ConsumeResult {
		const token = this.peek();
		let matched = true;
		if (expectedType.indexOf(token.type) == -1) {
			matched = false;
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage, expectedType}));
			this.pop();
		}
		return {matched, token};
	}

	protected consumeSequence({expectedMessage, expectedType}: ConsumeParams) {
		for (const type of expectedType) {
			this.consume({expectedMessage, expectedType: [type]});
		} 
	}

	protected parseIdentifier(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, range: token.range};
	}

	protected parseString(): StringNode {
		const token = this.pop();
		return {value: token.value, range: token.range};
	}

	protected parseInteger(): NumberNode {
		const token = this.pop();
		return {value: parseInt(token.value), range: token.range};
	}

	protected parseFloat(): NumberNode {
		const token = this.pop();
		return {value: parseFloat(token.value), range: token.range};
	}

	protected parseGUID(): IdentifierNode {
		const token = this.pop();
		return {symbol: token.value, range: token.range};
	}
	
	protected parseOperator(expectedTypes: Array<TokenType>): OperatorNode {
		const token = this.consume({
			expectedMessage: expectedMessage.operator,
			expectedType: expectedTypes
		}).token;
		return {operator: token.value, range: token.range};
	}

	protected parseType(): TypeNode | null {
		const token = this.pop();
		if (token.type != TokenType.IDENTIFIER) {
			this.diagnostics.push(unexpectedTokenDiagnosticFactory({actualToken: token, expectedMessage: expectedMessage.type}));
			if (token.type == TokenType.CLOSE_PARENTHESIS) return null;
		}
		this.consume({expectedType: [TokenType.CLOSE_PARENTHESIS]});
		return token.type == TokenType.IDENTIFIER ? {value: token.value, range: token.range} : null;
	}

	protected parseTypeEnumMember(): TypeEnumMemberNode {
		const token = this.pop();
		const parts = token.value.split(".", 2);
		return {type: parts[0], member: parts[1], range: token.range};
	}

	protected getTokenRange(): Range {
		return {
			start: {line: 0, character: 0},
			end: {
				line: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.line,
				character: this.tokens.length == 0 ? 0 : this.tokens[this.tokens.length - 1].range.end.character
			}
		}
	}

	abstract parse(): T;
}