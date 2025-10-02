import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { Token, TokenType } from '../parser/tokens';

export function unexpectedTokenDiagnosticFactory(actualToken: Token, expectedToken: TokenType | Array<TokenType>): Diagnostic {
	let message = "Unexpected token";
	return {
		source: "Osiris",
		range: actualToken.range,
		message: message,
		severity: DiagnosticSeverity.Error
	}
}