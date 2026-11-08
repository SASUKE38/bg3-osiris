import { TextDocument } from "vscode-languageserver-textdocument";
import { reservedSymbolsMapping, Token, TokenType } from "../tokens";

type RegexHandler = (regexMatch: RegExpMatchArray) => void;
type RegexHandlerFactory = (token: TokenType, trimmer?: TokenTrimmer) => RegexHandler;
type PositionRegex = () => RegExp;
type RegexFactory = (regex: RegExp) => PositionRegex;
type TokenTrimmer = (regexMatch: RegExpMatchArray) => string;

export interface RegexPattern {
	regex: PositionRegex;
	handler: RegexHandler;
}

export abstract class LexerBase {
	private pos = 0;
	private source: string;
	private document: TextDocument;
	protected abstract patterns: RegexPattern[];
	readonly tokens: Token[] = [];

	constructor(document: TextDocument) {
		this.document = document;
		this.source = document.getText();
	}

	protected handlerFactory: RegexHandlerFactory = (tokenType, trimmer) => {
		return (regexMatch: RegExpMatchArray) => {
			const content = trimmer ? trimmer(regexMatch) : regexMatch[0];
			if (tokenType != TokenType.SKIP) {
				this.push({
					type:
						tokenType == TokenType.IDENTIFIER && reservedSymbolsMapping.has(content)
							? (reservedSymbolsMapping.get(content) as TokenType)
							: tokenType,
					value: content,
					range: {
						start: this.document.positionAt(regexMatch.index as number),
						end: this.document.positionAt((regexMatch.index as number) + regexMatch[0].length)
					}
				});
			}
			this.advance(regexMatch[0].length);
		};
	};

	protected regexFactory: RegexFactory = (regex) => {
		return () => {
			const res = new RegExp(regex);
			res.lastIndex = this.pos;
			return res;
		};
	};

	private advance(n: number) {
		this.pos += n;
	}

	private push(token: Token) {
		this.tokens.push(token);
	}

	private atEOF(): boolean {
		return this.pos >= this.source.length;
	}

	protected stringTrimmer(regexMatch: RegExpMatchArray): string {
		return regexMatch[0].substring(1, regexMatch[0].length - (regexMatch[0].endsWith("\n") ? 0 : 1));
	}

	tokenize(): Token[] {
		while (!this.atEOF()) {
			let matched = false;
			for (const pattern of this.patterns) {
				const match = this.source.match(pattern.regex());
				if (match != null) {
					pattern.handler(match);
					matched = true;
					break;
				}
			}

			if (!matched) {
				console.error(`Lexer has no handler for token at ${this.document.positionAt(this.pos)}`);
				this.advance(1);
			}
		}
		this.push({
			type: TokenType.EOF,
			value: "EOF",
			range: {
				start: this.document.positionAt(this.pos),
				end: this.document.positionAt(this.pos)
			}
		});
		return this.tokens;
	}
}
