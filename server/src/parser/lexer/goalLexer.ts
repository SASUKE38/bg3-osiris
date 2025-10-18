import { LexerBase, RegexPattern } from './lexerBase';
import { TokenType } from '../tokens';

export class GoalLexer extends LexerBase {

	protected patterns: RegexPattern[] = [
		{regex: this.regexFactory(/\s+/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\/.*/y), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/\/\*([^*]|(\*[^/]))*\*+\//sy), handler: this.handlerFactory(TokenType.SKIP)},
		{regex: this.regexFactory(/([A-Za-z0-9_-]+)?[A-Fa-f0-9]{8}-([A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}/y), handler: this.handlerFactory(TokenType.GUID)},
		{regex: this.regexFactory(/-?[0-9]+\.[0-9]*/y), handler: this.handlerFactory(TokenType.FLOAT)},
		{regex: this.regexFactory(/-?[0-9]+/y), handler: this.handlerFactory(TokenType.INTEGER)},
		{regex: this.regexFactory(/[A-Z]+\.[A-Za-z]+/y), handler: this.handlerFactory(TokenType.ENUM_MEMBER)},
		{regex: this.regexFactory(/[A-Za-z0-9_-]+/y), handler: this.handlerFactory(TokenType.IDENTIFIER)},
		{regex: this.regexFactory(/"[^"]*"/y), handler: this.handlerFactory(TokenType.STRING)},
		{regex: this.regexFactory(/,/y), handler: this.handlerFactory(TokenType.COMMA)},
		{regex: this.regexFactory(/;/y), handler: this.handlerFactory(TokenType.SEMICOLON)},
		{regex: this.regexFactory(/\(/y), handler: this.handlerFactory(TokenType.OPEN_PARENTHESIS)},
		{regex: this.regexFactory(/\)/y), handler: this.handlerFactory(TokenType.CLOSE_PARENTHESIS)},
		{regex: this.regexFactory(/==/y), handler: this.handlerFactory(TokenType.EQUAL)},
		{regex: this.regexFactory(/!=/y), handler: this.handlerFactory(TokenType.NOT_EQUAL)},
		{regex: this.regexFactory(/<=/y), handler: this.handlerFactory(TokenType.LESS_THAN_OR_EQUAL)},
		{regex: this.regexFactory(/</y), handler: this.handlerFactory(TokenType.LESS_THAN)},
		{regex: this.regexFactory(/>=/y), handler: this.handlerFactory(TokenType.GREATER_THAN_OR_EQUAL)},
		{regex: this.regexFactory(/>/y), handler: this.handlerFactory(TokenType.GREATER_THAN)},
		{regex: this.regexFactory(/./y), handler: this.handlerFactory(TokenType.UNKNOWN)}
	];
	
	protected trimmedTokens: Map<TokenType, [number, number]> = new Map<TokenType, [number, number]>([
		[TokenType.STRING, [1, 1]]
	]);
}