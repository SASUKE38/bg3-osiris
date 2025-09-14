export enum TokenType {
	EOF,
	SKIP,

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

export const reservedSymbolsMapping: Map<string, TokenType> = new Map<string, TokenType>([
	["IF", TokenType.IF],
	["AND", TokenType.AND],
	["THEN", TokenType.THEN],
	["NOT", TokenType.NOT],
	["PROC", TokenType.PROC],
	["QRY", TokenType.QRY],
	["GoalCompleted", TokenType.GOAL_COMPLETED],
	["INIT", TokenType.INIT],
	["INITSECTION", TokenType.INITSECTION],
	["KB", TokenType.KB],
	["KBSECTION", TokenType.KBSECTION],
	["EXIT", TokenType.EXIT],
	["EXITSECTION", TokenType.EXITSECTION],
	["ENDEXITSECTION", TokenType.ENDEXITSECTION],
	["Version", TokenType.VERSION],
	["ParentTargetEdge", TokenType.PARENT_TARGET_EDGE],
	["SubGoalCombiner", TokenType.SUBGOAL_COMBINER]
]);

export interface Token {
	type: TokenType,
	value: string
}

export function printTokenAndType(token: Token) {
	console.log(`${TokenType[token.type]} : ${token.value}`)
}