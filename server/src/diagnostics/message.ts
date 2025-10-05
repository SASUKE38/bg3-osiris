import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Token, TokenType, typeReadableMapping } from '../parser/tokens';

export const expectedMessage = {
	type: "a type",
	operator: "an operator"
}

type unexpectedTokenDiagnosticParams = {
	actualToken: Token,
	expectedMessage?: string,
	expectedType?: Array<TokenType>
}

export function unexpectedTokenDiagnosticFactory({actualToken, expectedMessage, expectedType}: unexpectedTokenDiagnosticParams): Diagnostic {
	let message = "Unexpected token";

	if (expectedMessage) {
		message += `; expected ${expectedMessage}`;
	} else if (expectedType) {
		message += "; expected ";
		const types = expectedType.map(type => typeReadableMapping.get(type));
		if (types.length == 2) {
			message += `${types[0]} or ${types[1]}`;
		} else if (types.length > 1) {
			const final = `, or ${types.pop()}`;
			message += `${types.join(", ")}${final}`;
		} else {
			message += `${types}`;
		}
	}
	return {
		source: "Osiris",
		range: actualToken.range,
		message: message,
		severity: DiagnosticSeverity.Error
	}
}