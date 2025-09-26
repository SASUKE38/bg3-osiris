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
	private line: number = 1;
	private col: number = 1;
	private source: string;
	tokens: Array<Token> = [];

	private handlerFactory: RegexHandlerFactory = (tokenType) => {
		return (regexMatch: RegExpMatchArray) => {
			const content = tokenType == TokenType.STRING ? regexMatch[0].substring(1, regexMatch[0].length - 1) : regexMatch[0];
			if (tokenType != TokenType.SKIP) {
				if (tokenType == TokenType.IDENTIFIER && reservedSymbolsMapping.has(content)) {
					this.push({type: reservedSymbolsMapping.get(content) as TokenType, value: content, line: this.line, col: this.col});
				} else {
					this.push({type: tokenType, value: content, line: this.line, col: this.col});
				}
			}
			this.advance(regexMatch[0].length, regexMatch[0]);
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
		{regex: this.regexFactory(/-?[0-9]+\.[0-9]+/y), handler: this.handlerFactory(TokenType.FLOAT)},
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
		{regex: this.regexFactory(/>/y), handler: this.handlerFactory(TokenType.GREATER_THAN)}
	]
	
	constructor(source: string) {
		this.source = source;
	}

	advance(n: number, token: string) {
		if (token[token.length - 1] === "\n") {
			this.col = 1;
		} else {
			this.col += token.length;
		}
		this.line += token.split("\n").length - 1;
		this.pos += n;
	}

	push(token: Token) {
		this.tokens.push(token);
	}

	at_eof(): boolean {
		return this.pos >= this.source.length;
	}

	tokenize() {
		while (!this.at_eof()) {
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
				console.log(`Lexer encountered unknown token at line ${this.line}, col ${this.col}`);
				this.advance(1, "a");
			}
		}
		this.push({type: TokenType.EOF, value: "EOF", line: this.line, col: this.col});
	}
}