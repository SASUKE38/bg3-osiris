import { TextDocument } from 'vscode-languageserver-textdocument';
import { reservedSymbolsMapping, Token, TokenType } from './tokens';

type RegexHandler = (regexMatch: RegExpMatchArray) => void;
type RegexHandlerFactory = (token: TokenType) => RegexHandler;
type PositionRegex = () => RegExp;
type RegexFactory = (regex: RegExp) => PositionRegex;

interface RegexPattern {
	regex: PositionRegex
	handler: RegexHandler
}

export class Lexer {
	private pos: number = 0;
	private source: string;
	private document: TextDocument;
	private tokens: Array<Token> = [];

	private handlerFactory: RegexHandlerFactory = (tokenType) => {
		return (regexMatch: RegExpMatchArray) => {
			const content = tokenType == TokenType.STRING ? regexMatch[0].substring(1, regexMatch[0].length - 1) : regexMatch[0];
			if (tokenType != TokenType.SKIP) {
				this.push({
					type: tokenType == TokenType.IDENTIFIER && reservedSymbolsMapping.has(content) ? reservedSymbolsMapping.get(content) as TokenType : tokenType,
					value: content,
					range: {
						start: this.document.positionAt(regexMatch.index as number),
						end: this.document.positionAt(regexMatch.index as number + regexMatch[0].length)
					}
				});
			}
			this.advance(regexMatch[0].length);
		}
	};

	private regexFactory: RegexFactory = (regex) => {
		return () => {
			let res = new RegExp(regex);
			res.lastIndex = this.pos;
			return res;
		}
	}

	private patterns: Array<RegexPattern> = [
		{regex: this.regexFactory(/\s+/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\/.*/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\*([^*]|(\*[^/]))*\*+\//sy), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/([A-Za-z0-9_-]+)?[A-Fa-f0-9]{8}-([A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}/y), handler: this.handlerFactory(TokenType.GUID)},
		{regex: this.regexFactory(/-?[0-9]+\.[0-9]*/y), handler: this.handlerFactory(TokenType.FLOAT)},
		{regex: this.regexFactory(/-?[0-9]+/y), handler: this.handlerFactory(TokenType.INTEGER)},
		{regex: this.regexFactory(/[A-Za-z0-9_-]+/y), handler: this.handlerFactory(TokenType.IDENTIFIER)},
		{regex: this.regexFactory(/\"[^"]*\"/y), handler: this.handlerFactory(TokenType.STRING)},
		{regex: this.regexFactory(/\,/y), handler: this.handlerFactory(TokenType.COMMA)},
		{regex: this.regexFactory(/\;/y), handler: this.handlerFactory(TokenType.SEMICOLON)},
		{regex: this.regexFactory(/\./y), handler: this.handlerFactory(TokenType.PERIOD)},
		{regex: this.regexFactory(/\[/y), handler: this.handlerFactory(TokenType.OPEN_BRACKET)},
		{regex: this.regexFactory(/\]/y), handler: this.handlerFactory(TokenType.CLOSE_BRACKET)},
		{regex: this.regexFactory(/\{/y), handler: this.handlerFactory(TokenType.OPEN_BRACE)},
		{regex: this.regexFactory(/\}/y), handler: this.handlerFactory(TokenType.CLOSE_BRACE)},
		{regex: this.regexFactory(/\(/y), handler: this.handlerFactory(TokenType.OPEN_PARENTHESIS)},
		{regex: this.regexFactory(/\)/y), handler: this.handlerFactory(TokenType.CLOSE_PARENTHESIS)},
		{regex: this.regexFactory(/==/y), handler: this.handlerFactory(TokenType.EQUAL)},
		{regex: this.regexFactory(/!=/y), handler: this.handlerFactory(TokenType.NOT_EQUAL)},
		{regex: this.regexFactory(/<=/y), handler: this.handlerFactory(TokenType.LESS_THAN_OR_EQUAL)},
		{regex: this.regexFactory(/</y), handler: this.handlerFactory(TokenType.LESS_THAN)},
		{regex: this.regexFactory(/>=/y), handler: this.handlerFactory(TokenType.GREATER_THAN_OR_EQUAL)},
		{regex: this.regexFactory(/>/y), handler: this.handlerFactory(TokenType.GREATER_THAN)},
		{regex: this.regexFactory(/./y), handler: this.handlerFactory(TokenType.UNKNOWN)}
	]
	
	constructor(document: TextDocument) {
		this.document = document;
		this.source = document.getText();
	}

	private advance(n: number) {
		this.pos += n;
	}

	private push(token: Token) {
		this.tokens.push(token);
	}

	private atEOF(): boolean {
		return this.pos >= this.source.length;
	}

	getTokens() {
		return this.tokens;
	}

	tokenize() {
		while (!this.atEOF()) {
			let matched = false;
			for (var pattern of this.patterns) {
				var match = this.source.match(pattern.regex());
				if (match != null) {
					pattern.handler(match);
					matched = true;
					break;
				}
			}
			
			if (!matched) {
				console.log(`Lexer encountered unknown token at ${this.document.positionAt(this.pos)}`);
				this.advance(1);
			}
		}
		this.push({
			type: TokenType.EOF,
			value: "EOF",
			range: {
				start: this.document.positionAt(this.pos),
				end: this.document.positionAt(this.pos),
			}
		});
	}
}