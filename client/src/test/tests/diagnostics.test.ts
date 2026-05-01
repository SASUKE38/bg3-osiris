import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Should get diagnostics", () => {
	const docUri = getDocUri("Act3c_END_Emperor.txt");

	test("Line missing semicolon should produce error", async () => {
		await testDiagnostics(docUri, [
			{
				message: "Unexpected token; expected ';'",
				range: toRange(6, 0, 6, 30),
				severity: vscode.DiagnosticSeverity.Error,
				source: "osiris"
			}
		]);
	});
});

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
	await activate(docUri);

	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

	assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
	});
}
