import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Diagnostics Provider", () => {
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");
	const diagnostic08DocUri = getDocUri("DiagnosticTest_UnresolvedGoal.txt");
	const diagnostic10DocUri = getDocUri("DiagnosticTest_UnresolvedSignature.txt");
	const diagnostic11DocUri = getDocUri("DiagnosticTest_LocalTypeMismatch.txt");
	const diagnostic12DocUri = getDocUri("DiagnosticTest_UnresolvedType.txt");
	const diagnostic13DocUri = getDocUri("DiagnosticTest_InvalidProcDefinition.txt");
	const diagnostic15DocUri = getDocUri("DiagnosticTest_InvalidSymbolInStatement.txt");
	const diagnostic16DocUri = getDocUri("DiagnosticTest_Conditions.txt");
	const diagnostic19DocUri = getDocUri("DiagnosticTest_UnresolvedSymbol.txt");
	const diagnostic20DocUri = getDocUri("DiagnosticTest_Comparisons.txt");
	const diagnostic24DocUri = getDocUri("DiagnosticTest_ParamNotBound.txt");
	const diagnostic25DocUri = getDocUri("DiagnosticTest_Databases.txt");
	const diagnostic31DocUri = getDocUri("DiagnosticTest_Casts.txt");
	const diagnosticSource = "Osiris";

	// TODO: Fix placeholders in out slots of built-in queries
	// TODO: Fix documentation label for CrimeGetTension
	// TODO: Don't report naming violations for procs with the same name as a builtin?
	// TODO: Allow numbers after casts
	// TODO: Fix non-database signatures being examined for reads and writes
	// TODO: Verify behavior of E32 with constants


	test("Diagnostics for script with multiple diagnostics should get array for all of them", async () => {
		await testDiagnostics(endDocUri, [
			{
				message: "'FlagSet' is read from but not written to",
				range: toRange(108, 0, 108, 7),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W25"
			},
			{
				message: "Unexpected token; expected ';'",
				range: toRange(6, 0, 6, 30),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E36"
			},
			{
				message: "The intrinsic type of 'UNKNOWN' does not match the specified intrinsic type of 'CHARACTER'.",
				range: toRange(28, 54, 28, 56),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E11"
			},
			{
				message: "Unexpected token; expected a parameter",
				range: toRange(28, 56, 28, 57),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E36"
			}
		]);
	});

	test("Diagnostics for goal with unresolved parent should return array with diagnostic 8", async () => {
		await testDiagnostics(diagnostic08DocUri, [
			{
				message: "Could not find parent goal 'SomeNonExistentGoal'.",
				range: toRange(9, 17, 9, 38),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E08"
			}
		]);
	});

	test("Diagnostics for goal with unresolved signature should return array with diagnostic 10", async () => {
		await testDiagnostics(diagnostic10DocUri, [
			{
				message: "The fully typed signature of 'PROC_SomeProc' could not be determined.",
				range: toRange(7, 0, 7, 13),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E10"
			}
		]);
	});

	test("Diagnostics for goal with local type mismatch should return array with diagnostic 11", async () => {
		await testDiagnostics(diagnostic11DocUri, [
			{
				message: "The intrinsic type of 'INTEGER' does not match the specified intrinsic type of 'CHARACTER'.",
				range: toRange(14, 24, 14, 28),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E11"
			}
		]);
	});

	test("Diagnostics for goal with unresolved type should return array with diagnostic 12", async () => {
		await testDiagnostics(diagnostic12DocUri, [
			{
				message: "Type NOTATYPE could not be resolved.",
				range: toRange(7, 25, 7, 33),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E12"
			}
		]);
	});

	test("Diagnostics for goal with invalid proc definition should return array with diagnostics 13, 17, and 23", async () => {
		await testDiagnostics(diagnostic13DocUri, [
			{
				message: "PROC definitions must begin with a PROC signature.",
				range: toRange(12, 0, 12, 15),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E13"
			},
			{
				message: "PROC rules must begin with a PROC call, QRY_SomeQuery is a query.",
				range: toRange(11, 0, 11, 4),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E17"
			},
			{
				message: "PROC rules should be named with a PROC_ prefix.",
				range: toRange(12, 0, 12, 13),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W23"
			}
		]);
	});

	test("Diagnostics for goal with unresolved type should return array with diagnostic 15", async () => {
		await testDiagnostics(diagnostic15DocUri, [
			{
				message:
					"Rule actions can only contain builtin calls, databases, and procs; QRY_SomeOtherQuery is a query.",
				range: toRange(9, 0, 9, 18),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E15"
			}
		]);
	});

	test("Diagnostics for goal with invalid condition deletions and types should return array with diagnostic 16 and 18", async () => {
		await testDiagnostics(diagnostic16DocUri, [
			{
				message: "Conditions can only be queries or databases; PROC_SomeProc is a proc.",
				range: toRange(14, 0, 14, 13),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E18"
			},
			{
				message: "NOT can only be used with databases",
				range: toRange(18, 4, 18, 17),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E16"
			},
			{
				message: "Conditions can only be queries or databases; PROC_SomeProc is a proc.",
				range: toRange(18, 4, 18, 17),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E18"
			},
			{
				message: "NOT can only be used with databases",
				range: toRange(20, 4, 20, 17),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E16"
			}
		]);
	});

	test("Diagnostics for goal with unresolved symbol should return array with diagnostic 19", async () => {
		await testDiagnostics(diagnostic19DocUri, [
			{
				message: "'PROC_SomeProc' could not be resolved.",
				range: toRange(14, 0, 14, 37),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E19"
			}
		]);
	});

	test("Diagnostics for goal with comparison errors should return array with diagnostics 20, 33, and 34", async () => {
		await testDiagnostics(diagnostic20DocUri, [
			{
				message: "Less than/greater than comparison uses a string or GUIDSTRING",
				range: toRange(9, 0, 9, 16),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W20"
			},
			{
				message: "Less than/greater than comparison uses a string or GUIDSTRING",
				range: toRange(16, 0, 16, 46),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W20"
			},
			{
				message: "Binary operation has the same variable on both sides",
				range: toRange(23, 0, 23, 8),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E33"
			},
			{
				message: "Less than/greater than comparison uses a string or GUIDSTRING",
				range: toRange(30, 0, 30, 56),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W20"
			},
			{
				message: "Comparisons between GUIDSTRING and string are known to have unwanted side effects",
				range: toRange(30, 0, 30, 56),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E34"
			}
		]);
	});

	test("Diagnostics for goal with unbound parameters should return array with diagnostic 24", async () => {
		await testDiagnostics(diagnostic24DocUri, [
			{
				message: "'_Var' is not bound here.",
				range: toRange(14, 23, 14, 27),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E24"
			},
			{
				message: "A placeholder is not allowed here.",
				range: toRange(14, 29, 14, 30),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E24"
			}
		]);
	});

	test("Diagnostics for goal with database errors should return array with diagnostics 25 and 26", async () => {
		await testDiagnostics(diagnostic25DocUri, [
			{
				message: "'DB_SomeUnreadDatabase' is written to but not read from.",
				range: toRange(4, 0, 4, 21),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W25"
			},
			{
				message: "'DB_SomeUnwrittenDatabase' is read from but not written to",
				range: toRange(11, 0, 11, 24),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W25"
			},
			{
				message: "'SomeBadlyNamedDatabase' is read from but not written to",
				range: toRange(16, 0, 16, 22),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W25"
			},
			{
				message: "Databases should be named with a DB_ prefix.",
				range: toRange(16, 0, 16, 22),
				severity: vscode.DiagnosticSeverity.Warning,
				source: diagnosticSource,
				code: "W26"
			}
		]);
	});

	test("Diagnostics for goal with cast errors should return array with diagnostics 31 and 32", async () => {
		await testDiagnostics(diagnostic31DocUri, [
			{
				message: "'_Integer' converted to unrelated type 'STRING'",
				range: toRange(14, 26, 14, 32),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E31"
			},
			{
				message: "'NULL_00000000-0000-0000-0000-000000000000' converted to unrelated alias 'ITEMROOT'",
				range: toRange(14, 44, 14, 52),
				severity: vscode.DiagnosticSeverity.Error,
				source: diagnosticSource,
				code: "E32"
			}
		]);
	});
});

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
	await activate(docUri);
	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
	const compareFn = (a: vscode.Diagnostic, b: vscode.Diagnostic) => {
		if (a.message < b.message) return -1;
		if (a.message === b.message) return 0;
		return 1;
	};
	expectedDiagnostics.sort(compareFn);
	actualDiagnostics.sort(compareFn);

	assert.strictEqual(actualDiagnostics.length, expectedDiagnostics.length);
	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity);
		assert.strictEqual(actualDiagnostic.source, expectedDiagnostic.source);
		assert.strictEqual(actualDiagnostic.code, expectedDiagnostic.code);
	});
}
