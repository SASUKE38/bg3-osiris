import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Diagnostics Provider", () => {
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");
	const diagnostic08DocUri = getDocUri("DiagnosticTest_UnresolvedGoal.txt");
	const diagnostic10DocUri = getDocUri("DiagnosticTest_UnresolvedSignature.txt");
	const diagnostic11DocUri = getDocUri("DiagnosticTest_LocalTypeMismatch.txt");
	const diagnosticSource = "Osiris";

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
