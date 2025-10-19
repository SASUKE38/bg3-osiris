import { TextDocument } from "vscode-languageserver-textdocument";
import { reservedSymbolsMapping, Token, TokenType } from "../tokens";

type RegexHandler = (regexMatch: RegExpMatchArray) => void;
type RegexHandlerFactory = (token: TokenType) => RegexHandler;
type PositionRegex = () => RegExp;
type RegexFactory = (regex: RegExp) => PositionRegex;

export interface RegexPattern {
	regex: PositionRegex;
	handler: RegexHandler;
}

export abstract class LexerBase {
	private pos = 0;
	private source: string;
	private document: TextDocument;
	protected abstract patterns: RegexPattern[];
	protected abstract trimmedTokens: Map<TokenType, [number, number]>;
	readonly tokens: Token[] = [];

	constructor(document: TextDocument) {
		this.document = document;
		this.source = document.getText();
	}

	protected handlerFactory: RegexHandlerFactory = (tokenType) => {
		return (regexMatch: RegExpMatchArray) => {
			const content = this.trimmedTokens.has(tokenType) ? this.stripToken(tokenType, regexMatch) : regexMatch[0];
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

	private stripToken(tokenType: TokenType, regexMatch: RegExpMatchArray): string {
		const indices = this.trimmedTokens.get(tokenType) as [number, number];
		return regexMatch[0].substring(indices[0], regexMatch[0].length - indices[1]);
	}

	tokenize() {
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
	}
}
