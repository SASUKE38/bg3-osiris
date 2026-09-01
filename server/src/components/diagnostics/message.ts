import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode-languageserver";
import { Token, TokenType, typeReadableMapping } from "../../parser/tokens";
import { DiagnosticCode } from "./diagnosticCode";
import { ComparisonNode, SignatureNode, StringNode } from "../../parser/ast/nodes";

const diagnosticSource = "Osiris";

interface DiagnosticParamsBase {
	range: Range
}

//#region Rule Structure

interface InvalidProcDefinitionParams extends DiagnosticParamsBase {
	type: "QRY" | "PROC";
}

export function invalidProcDefinitionDiagnosticFactory({ type, range }: InvalidProcDefinitionParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `${type} definitions must begin with a ${type} signature.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.InvalidProcDefinition
	};
}

export interface InvalidSignatureInSectionParams extends DiagnosticParamsBase {
	name: string;
	type: string;
	fact: boolean;
}

export function invalidSymbolInStatementDiagnosticFactory({
	name,
	type,
	range,
	fact = false
}: InvalidSignatureInSectionParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `${fact ? "Facts" : "Rule actions"} can only contain builtin calls, databases, and procs; ${name} is a ${type}.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.InvalidSymbolInStatement
	};
}

export interface InvalidDeletionFromNonDatabaseParams extends DiagnosticParamsBase {}

export function invalidDeletionFromNonDatabaseDiagnosticFactory({ range }: InvalidDeletionFromNonDatabaseParams) {
	return {
		source: diagnosticSource,
		range,
		message: `NOT can only be used with databases`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.CanOnlyDeleteFromDatabase
	};
}

export interface InvalidSymbolInInitialConditionParams extends DiagnosticParamsBase {
	ruleType: "PROC" | "QRY" | "IF";
	signatureName: string;
	signatureType?: string;
}

export function invalidSymbolInInitialConditionDiagnosticFactory({
	range,
	ruleType,
	signatureName,
	signatureType
}: InvalidSymbolInInitialConditionParams) {
	let requiredCall = "";
	switch (ruleType) {
		case "PROC":
			requiredCall = "PROC call";
			break;
		case "QRY":
			requiredCall = "user-defined QRY";
			break;
		case "IF":
			requiredCall = "database or event";
			break;
	}
	return {
		source: diagnosticSource,
		range,
		message: `${ruleType} rules must begin with a ${requiredCall}${signatureType ? `, ${signatureName} is a ${signatureType}` : ``}.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.InvalidSymbolInInitialCondition
	};
}

export interface InvalidFunctionTypeInConditionParams extends DiagnosticParamsBase {
	name: string;
	actualType: string;
}

export function invalidFunctionTypeInConditionDiagnosticFactory({
	range,
	name,
	actualType
}: InvalidFunctionTypeInConditionParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `Conditions can only be queries or databases; ${name} is a ${actualType}.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.InvalidFunctionTypeInCondition
	};
}

export interface RuleNamingStyleParams extends DiagnosticParamsBase {
	ruleType: "PROC" | "QRY";
	prefix: "PROC_" | "QRY_";
}

export function ruleNamingStyleDiagnosticFactory({ range, ruleType, prefix }: RuleNamingStyleParams) {
	return {
		source: diagnosticSource,
		range,
		message: `${ruleType} rules must be named with a ${prefix} prefix.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.RuleNamingStyle
	};
}

export interface DbNamingStyleParams extends DiagnosticParamsBase {}

export function DbNamingStyleDiagnosticFactory({ range }: DbNamingStyleParams) {
	return {
		source: diagnosticSource,
		range,
		message: `Databases must be named with a DB_ prefix.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.DbNamingStyle
	};
}

//#endregion

//#region Goal Arrangement

interface GoalArrangementDiagnosticParamsBase extends DiagnosticParamsBase {
	name: string
}

interface UnresolvedGoalParams extends GoalArrangementDiagnosticParamsBase {}

export function unresolvedGoalDiagnosticFactory({ range, name }: UnresolvedGoalParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `Could not find parent goal '${name}'.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.UnresolvedGoal
	};
}

interface GoalAlreadyDefinedParams extends GoalArrangementDiagnosticParamsBase {}

export function goalAlreadyDefinedDiagnosticFactory({ range, name }: GoalAlreadyDefinedParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `Goal '${name}' is already defined.`,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.GoalAlreadyDefined
	};
}

//#endregion

//#region Database

interface UnusedDatabaseWarningParams extends DiagnosticParamsBase {
	name: string,
	isRead: boolean;
}

export function unusedDatabaseWarningDiagnosticFactory({ range, name, isRead }: UnusedDatabaseWarningParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: `'${name}' is ${isRead ? "read from" : "written to"} but not ${isRead ? "written to" : "read from."}`,
		severity: DiagnosticSeverity.Warning,
		code: DiagnosticCode.UnusedDatabaseWarning
	};
}

//#endregion

//#region Comparisons

interface StringLtGtComparisonParams extends DiagnosticParamsBase {}

export function stringLtGtComparisonDiagnosticFactory({ range }: StringLtGtComparisonParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: "Less than/greater than comparison uses a string or GUIDSTRING",
		severity: DiagnosticSeverity.Warning,
		code: DiagnosticCode.StringLtGtComparison
	};
}

interface BinaryOperationSameRhsLhsParams extends DiagnosticParamsBase {}

export function binaryOperationSameRhsLhsDiagnosticFactory({ range }: BinaryOperationSameRhsLhsParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: "Binary operation has the same value on both sides",
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.BinaryOperationSameRhsLhs
	};
}

interface RiskyComparisonParams extends DiagnosticParamsBase {}

export function riskyComparisonDiagnosticFactory({ range }: RiskyComparisonParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
		message: "Comparisons between GUIDSTRING and string are known to have unwanted side effects",
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.RiskyComparison
	};
}

//#endregion

//#region Syntax

interface RuleMissingActionsParams extends DiagnosticParamsBase {}

export function ruleMissingActionsDiagnosticFactory({ range }: RuleMissingActionsParams): Diagnostic {
	return {
		source: diagnosticSource,
		range,
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
	flow: "parameter flow",
	eofOrParentTargetEdge: "ParentTargetEdge or end of file"
};

interface unexpectedTokenDiagnosticParams extends DiagnosticParamsBase {
	expectedMessage?: string;
	expectedType?: TokenType[];
}

export function unexpectedTokenDiagnosticFactory({
	range,
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
		range,
		message: message,
		severity: DiagnosticSeverity.Error,
		code: DiagnosticCode.UnexpectedToken
	};
}
//#endregion
