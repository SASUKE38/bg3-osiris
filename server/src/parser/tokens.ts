import { Range } from 'vscode-languageserver';

export enum TokenType {
	EOF,
	SKIP,
	UNKNOWN,

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

export const reservedSymbolsMapping = new Map<string, TokenType>([
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

export const typeReadableMapping = new Map<TokenType, string>([
	[TokenType.EOF, "end of file"],
	[TokenType.SKIP, "none"],
	[TokenType.UNKNOWN, "unknown"],

	// General
	[TokenType.COMMA, "\',\'"],
	[TokenType.SEMICOLON, "\';\'"],
	[TokenType.PERIOD, "\'.\'"],
	[TokenType.STRING, "string"],
	[TokenType.GUID, "GUID"],
	[TokenType.IDENTIFIER, "identifier"],
	[TokenType.INTEGER, "integer"],
	[TokenType.FLOAT, "float"],

	// Groups
	[TokenType.OPEN_BRACKET, "\'[\'"],
	[TokenType.CLOSE_BRACKET, "\']\'"],
	[TokenType.OPEN_BRACE, "\'{\'"],
	[TokenType.CLOSE_BRACE, "\'}\'"],
	[TokenType.OPEN_PARENTHESIS, "\'(\'"],
	[TokenType.CLOSE_PARENTHESIS, "\')\'"],

	// Equivalency
	[TokenType.EQUAL, "=="],
	[TokenType.NOT_EQUAL, "!="],
	[TokenType.LESS_THAN, "<"],
	[TokenType.LESS_THAN_OR_EQUAL, "<="],
	[TokenType.GREATER_THAN, ">"],
	[TokenType.GREATER_THAN_OR_EQUAL, ">="],

	// Keywords
	[TokenType.IF, "IF"],
	[TokenType.AND, "AND"],
	[TokenType.THEN, "THEN"],
	[TokenType.NOT, "NOT"],
	[TokenType.PROC, "PROC"],
	[TokenType.QRY, "QRY"],
	[TokenType.GOAL_COMPLETED, "GoalCompleted"],

	// Sections
	[TokenType.INIT, "INIT"],
	[TokenType.INITSECTION, "INITSECTION"],
	[TokenType.KB, "KB"],
	[TokenType.KBSECTION, "KBSECTION"],
	[TokenType.EXIT, "EXIT"],
	[TokenType.EXITSECTION, "EXITSECTION"],
	[TokenType.ENDEXITSECTION, "ENDEXITSECTION"],
	[TokenType.VERSION, "Version"],
	[TokenType.PARENT_TARGET_EDGE, "ParentTargetEdge"],
	[TokenType.SUBGOAL_COMBINER, "SubGoalCombiner"]
]);

export interface Token {
	type: TokenType,
	value: string,
	range: Range
}