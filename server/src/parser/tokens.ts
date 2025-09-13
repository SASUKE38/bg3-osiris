export enum TokenType {
	EOF,

	// General
	COMMA,
	SEMICOLON,
	PERIOD,
	STRING,
	GUID,
	IDENTIFIER,
	INTEGER,
	FLOAT,

	// Groups
	OPEN_BRACKET,
	CLOSE_BRACKET,
	OPEN_BRACE,
	CLOSE_BRACE,
	OPEN_PARENTHESIS,
	CLOSE_PARENTHESIS,

	// Equivalency
	EQUAL,
	NOT_EQUAL,
	LESS_THAN,
	LESS_THAN_OR_EQUAL,
	GREATER_THAN,
	GREATER_THAN_OR_EQUAL,

	// Keywords
	IF,
	AND,
	THEN,
	NOT,
	PROC,
	QRY,
	GOAL_COMPLETED,

	// Sections
	INIT,
	INITSECTION,
	KB,
	KBSECTION,
	EXIT,
	EXITSECTION,
	ENDEXITSECTION,
	VERSION,
	PARENT_TARGET_EDGE,
	SUBGOAL_COMBINER
}

export interface Token {
	type: TokenType,
	value: string
}

export function printTokenAndType(token: Token) {
	console.log(`${TokenType[token.type]} : ${token.value}`)
}