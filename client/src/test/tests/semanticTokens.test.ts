import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "../helper";

suite("Should get semantic tokens", () => {
	const docUri = getDocUri("semanticTokens.txt");

	test("Builtins should be semantic tokens", async () => {
		const builder = new vscode.SemanticTokensBuilder();
		builder.push(14, 0, 14, 0);
		builder.push(23, 0, 8, 2);
		builder.push(26, 0, 14, 0);
		builder.push(29, 0, 7, 2);
		builder.push(37, 0, 7, 2);
		builder.push(39, 11, 14, 2);
		builder.push(42, 1, 14, 0);
		builder.push(43, 7, 10, 0);
		builder.push(49, 0, 14, 1);
		builder.push(53, 0, 10, 0);
		builder.push(54, 0, 10, 0);
		await testSemanticTokens(docUri, builder.build());
	});

	test("Semantic tokens legend should have types call, event, query, function, enum, enumMember", async () => {
		await testSemanticTokensLegend(
			docUri,
			new vscode.SemanticTokensLegend(["call", "event", "query", "function", "enum", "enumMember"])
		);
	});
});

async function testSemanticTokens(docUri: vscode.Uri, expectedTokens: vscode.SemanticTokens) {
	await activate(docUri);

	const actualTokens = (await vscode.commands.executeCommand(
		"vscode.provideDocumentSemanticTokens",
		docUri
	)) as vscode.SemanticTokens;

	assert.ok(actualTokens.data.length === expectedTokens.data.length);
	assert.deepStrictEqual(actualTokens, expectedTokens);
}

async function testSemanticTokensLegend(docUri: vscode.Uri, expectedLegend: vscode.SemanticTokensLegend) {
	await activate(docUri);

	const actualLegend = (await vscode.commands.executeCommand(
		"vscode.provideDocumentSemanticTokensLegend",
		docUri
	)) as vscode.SemanticTokensLegend;

	assert.ok(actualLegend.tokenModifiers.length === 0);
	assert.ok(expectedLegend.tokenModifiers.length === 0);
	assert.deepStrictEqual(actualLegend.tokenTypes, expectedLegend.tokenTypes);
}
