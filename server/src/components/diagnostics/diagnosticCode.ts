/**
 * Collection of error codes. Based on:
 * https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Story/Compiler/CompilationContext.cs#L183
 */
export const enum DiagnosticCode {
	// Miscellaenous internal error - should not happen.
	InternalError = "E00",

	// A type ID was declared multiple times in the story definition file.
	TypeIdAlreadyDefined = "E01",

	// A type name (alias)  was declared multiple times in the story definition file.
	TypeNameAlreadyDefined = "E02",

	// The type ID is either an intrinsic ID or is outside the allowed range.
	TypeIdInvalid = "E03",

	// The alias type ID doesn't point to a valid intrinsic type ID
	IntrinsicTypeIdInvalid = "E04",

	// A function with the same signature already exists.
	SignatureAlreadyDefined = "E05",

	// The type of an argument could not be resolved in a builtin function.
	// (This only occurs when parsing story headers, not in goal code)
	UnresolvedTypeInSignature = "E06",

	// A goal with the same name was seen earlier.
	GoalAlreadyDefined = "E07",

	// The parent goal specified in the goal script was not found.
	UnresolvedGoal = "E08",

	// Failed to infer the type of a rule-local variable.
	UnresolvedVariableType = "E09",

	// The function signature (full typed parameter list) of a function
	// could not be determined. This is likely the result of a failed type inference.
	UnresolvedSignature = "E10",

	// The intrinsic type of a function parameter does not match the expected type.
	LocalTypeMismatch = "E11",

	// Value with unknown type encountered during IR generation.
	UnresolvedType = "E12",

	// PROC/QRY declarations must start with a PROC/QRY name as the first condition.
	InvalidProcDefinition = "E13",

	// Fact contains a function that is not callable
	// (the function is not a call, database or proc).
	InvalidSymbolInFact = "E14",

	// Rule action contains a function that is not callable
	// (the function is not a call, database or proc).
	InvalidSymbolInStatement = "E15",

	// "NOT" action contains a non-database function.
	CanOnlyDeleteFromDatabase = "E16",

	// Initial PROC/QRY/IF function type differs from allowed type.
	InvalidSymbolInInitialCondition = "E17",

	// Condition contains a function that is not a query or database.
	InvalidFunctionTypeInCondition = "E18",

	// Function name could not be resolved.
	UnresolvedSymbol = "E19",

	// Use of less/greater operators on strings or guidstrings.
	StringLtGtComparison = "W20",

	// The alias type of a function parameter does not match the expected type.
	GuidAliasMismatch = "E21",

	// Object name GUID is prefixed with a type that is not known.
	GuidPrefixNotKnown = "W22",

	// PROC_/QRY_ naming style violation.
	RuleNamingStyle = "W23",

	// A rule variable was used in a read context, but was not yet bound.
	ParamNotBound = "E24",

	// The database is likely unused or unpopulated.
	// (Written but not read, or vice versa)
	UnusedDatabaseWarning = "W25",

	// The database is likely unused or unpopulated.
	// (Written but not read, or vice versa)
	UnusedDatabaseError = "E25",

	// Database "DB_" naming convention violation.
	DbNamingStyle = "W26",

	// Object name GUID could not be resolved to a game object.
	UnresolvedGameObjectName = "W27",

	// Type of name GUID differs from type of game object.
	GameObjectTypeMismatch = "W28",

	// Name part of name GUID differs from name of game object.
	GameObjectNameMismatch = "W29",

	// Multiple definitions seen for the same function with different signatures.
	ProcTypeMismatch = "E30",

	// Attempted to cast a type to an unrelated/incompatible type (i.e. STRING to INTEGER)
	CastToUnrelatedType = "E31",

	// Attempted to cast an alias to an unrelated alias (i.e. CHARACTERGUID to ITEMGUID)
	CastToUnrelatedGuidAlias = "E32",

	// Left-hand side and right-hand side variables are the same in a binary operation.
	// This will result in an "invalid compare" error in runtime.
	BinaryOperationSameRhsLhs = "E33",

	// comparison on types that have known bugs or side effects
	// (currently this only triggers on GUIDSTRING - STRING comparison)
	RiskyComparison = "E34",

	// The database is possibly used in an incorrect way.
	// (Deleted and read, but not written)
	UnwrittenDatabase = "W35",

	/* Custom */
	// Encountered unexpected token during parsing
	UnexpectedToken = "E36",

	// A rule has no actions
	RuleMissingActions = "E37"
}
