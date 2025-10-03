import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Token, TokenType, typeReadableMapping } from '../parser/tokens';

export function unexpectedTokenDiagnosticFactory(actualToken: Token, ...expectedToken: TokenType[]): Diagnostic {
	let message = "Unexpected token";

	if (expectedToken) {
		const types = expectedToken.map(type => typeReadableMapping.get(type));
		const final = types.length > 1 ? `, or ${types.pop()}` : "";
		message += `, expected ${types.join()}${final}`;
	}
	return {
		source: "Osiris",
		range: actualToken.range,
		message: message,
		severity: DiagnosticSeverity.Error
	}
}