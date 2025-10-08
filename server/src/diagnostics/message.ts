import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Token, TokenType, typeReadableMapping } from '../parser/tokens';

type RuleMissingActionsParams = {
	rule: Token
}

export function ruleMissingActionsDiagnosticFactory({rule}: RuleMissingActionsParams): Diagnostic {
	return {
		source: "Osiris",
		range: rule.range,
		message: "Rule must contain at least one signature in THEN clause",
		severity: DiagnosticSeverity.Error
	}
}

export const expectedMessage = {
	type: "a type",
	operator: "an operator",
	signatureOrComparison: "a signature or comparison",
	andOrThen: "AND or THEN",
	parameter: "a parameter"
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