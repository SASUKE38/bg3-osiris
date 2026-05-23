import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { Token, TokenType, typeReadableMapping } from "../../parser/tokens";
import { DiagnosticCode } from "./diagnosticCode";
import { ComparisonNode } from "../../parser/ast/nodes";

const diagnosticSource = "Osiris";

//#region Comparisons

interface StringLtGtComparisonParams {
	comparison: ComparisonNode;
}

export function stringLtGtComparisonDiagnosticFactory({ comparison }: StringLtGtComparisonParams): Diagnostic {
	return {
		source: diagnosticSource,
		range: comparison.range,
		message: "Less than/greater than comparison uses a string or GUIDSTRING",
		severity: DiagnosticSeverity.Warning,
		code: DiagnosticCode.StringLtGtComparison
	};
}

interface BinaryOperationSameRhsLhsParams {
	comparison: ComparisonNode;
}

export function binaryOperationSameRhsLhsDiagnosticFactory({
	comparison
}: BinaryOperationSameRhsLhsParams): Diagnostic {
	return {
		source: diagnosticSource,
		range: comparison.range,
		message: "Binary operation has the same value on both sides",
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.BinaryOperationSameRhsLhs
	};
}

interface RiskyComparisonParams {
	comparison: ComparisonNode;
}

export function riskyComparisonDiagnosticFactory({ comparison }: RiskyComparisonParams): Diagnostic {
	return {
		source: diagnosticSource,
		range: comparison.range,
		message: "Comparisons between GUIDSTRING and string are known to have unwanted side effects",
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.RiskyComparison
	};
}

//#endregion

//#region Syntax

interface RuleMissingActionsParams {
	rule: Token;
}

export function ruleMissingActionsDiagnosticFactory({ rule }: RuleMissingActionsParams): Diagnostic {
	return {
		source: diagnosticSource,
		range: rule.range,
		message: "Rule must contain at least one signature in THEN clause",
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.RuleMissingActions
	};
}

export const expectedMessage = {
	type: "a type",
	operator: "an operator",
	signatureOrComparison: "a signature or comparison",
	andOrThen: "AND or THEN",
	parameter: "a parameter",
	flow: "parameter flow"
};

interface unexpectedTokenDiagnosticParams {
	actualToken: Token;
	expectedMessage?: string;
	expectedType?: TokenType[];
}

export function unexpectedTokenDiagnosticFactory({
	actualToken,
	expectedMessage,
	expectedType
}: unexpectedTokenDiagnosticParams): Diagnostic {
	let message = "Unexpected token";

	if (expectedMessage) {
		message += `; expected ${expectedMessage}`;
	} else if (expectedType) {
		message += "; expected ";
		const types = expectedType.map((type) => typeReadableMapping.get(type));
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
		source: diagnosticSource,
		range: actualToken.range,
		message: message,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.UnexpectedToken
	};
}
//#endregion
