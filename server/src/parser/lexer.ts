import { Token, TokenType } from './tokens';

interface RegexHandler {
	(regex: RegExp): void
}

interface RegexHandlerFactory {
	(token: TokenType, value: string): RegexHandler
}

interface RegexPattern {
	regex: RegExp
	handler: RegexHandler
}

export class Lexer {
	private pos: number = 0;
	private tokens: Array<Token> = [];
	private source: string;

	private defaultHandlerFactory: RegexHandlerFactory = (tokenType, string) => {
		return (regex: RegExp) => {
			this.advance(string.length);
			this.push({type: tokenType, value: string});
		}
	};

	private patterns: Array<RegexPattern> = [
		{regex: /\./, handler: this.defaultHandlerFactory(TokenType.PERIOD, ".")}
	]

	constructor(source: string) {
		this.source = source;
	}

	advance(n: number) {
		this.pos += n;
	}

	push(token: Token) {
		this.tokens.push(token);
	}

	at(): string {
		return this.source[this.pos];
	}

	at_eof(): boolean {
		return this.pos >= this.source.length;
	}

	remainder(): string {
		return this.source.substring(this.pos);
	}

	tokenize() {
		while (!this.at_eof()) {
			let matched = false;
			for (var pattern of this.patterns) {
				var match = this.remainder().match(pattern.regex);
				if (match != null && match.index == 0) {
					pattern.handler(pattern.regex);
					matched = true;
					break;
				}
			}

			if (!matched) {
				console.log(`Lexer error: encountered unknown token at position ${this.pos}`);
				this.advance(1);
			}
		}
		this.push({type: TokenType.EOF, value: "EOF"});
	}
}