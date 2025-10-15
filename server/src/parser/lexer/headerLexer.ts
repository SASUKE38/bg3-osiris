import { TextDocument } from 'vscode-languageserver-textdocument';
import { LexerBase, RegexPattern } from './lexerBase';
import { TokenType } from '../tokens';

export class HeaderLexer extends LexerBase {

	protected patterns: Array<RegexPattern> = [
		{regex: this.regexFactory(/\s+/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\/.*/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\*([^*]|(\*[^/]))*\*+\//sy), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/-?[0-9]+\.[0-9]*/y), handler: this.handlerFactory(TokenType.FLOAT)},
		{regex: this.regexFactory(/-?[0-9]+/y), handler: this.handlerFactory(TokenType.INTEGER)},
		{regex: this.regexFactory(/INIT\s*\{[^\}]*\}/sy), handler: this.handlerFactory(TokenType.INIT)},
		{regex: this.regexFactory(/KB\s*\{[^\}]*\}/sy), handler: this.handlerFactory(TokenType.KB)},
		{regex: this.regexFactory(/EXIT\s*\{[^\}]*\}/sy), handler: this.handlerFactory(TokenType.EXIT)},
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
		{regex: this.regexFactory(/=/y), handler: this.handlerFactory(TokenType.ENUM_ASSIGNMENT)},
		{regex: this.regexFactory(/./y), handler: this.handlerFactory(TokenType.UNKNOWN)}
	];

	protected trimmedTokens: Map<TokenType, [number, number]> = new Map<TokenType, [number, number]>([
		[TokenType.STRING, [1, 1]],
		[TokenType.INIT, [5, 1]],
		[TokenType.KB, [3, 1]],
		[TokenType.EXIT, [5, 1]]
	]);
	
	constructor(document: TextDocument) {
		super(document);
	}
}