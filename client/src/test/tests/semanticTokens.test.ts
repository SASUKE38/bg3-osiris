import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "../helper";

suite("Semantic Tokens", () => {
	const docUri = getDocUri("Act3c_EPI_Emperor.txt");

	test("Builtins should be semantic tokens", async () => {
		const builder = new vscode.SemanticTokensBuilder();
		builder.push(91, 0, 14, 0);
		builder.push(100, 0, 8, 2);
		builder.push(103, 0, 14, 0);
		builder.push(114, 0, 7, 2);
		builder.push(117, 0, 6, 0);
		builder.push(123, 11, 10, 0);
		builder.push(124, 1, 20, 0);
		builder.push(126, 7, 10, 0);
		builder.push(127, 0, 16, 0);
		builder.push(142, 0, 7, 2);
		builder.push(157, 0, 7, 0);
		builder.push(164, 0, 7, 2);
		builder.push(172, 0, 7, 2);
		builder.push(174, 0, 14, 2);
		builder.push(177, 0, 14, 0);
		builder.push(178, 0, 10, 0);
		builder.push(190, 0, 11, 0);
		builder.push(199, 0, 11, 0);
		builder.push(202, 0, 8, 1);
		builder.push(232, 0, 13, 0);
		builder.push(235, 0, 7, 2);
		builder.push(243, 0, 15, 2);
		builder.push(245, 0, 11, 0);
		builder.push(249, 0, 7, 2);
		builder.push(255, 0, 15, 2);
		builder.push(257, 0, 11, 0);
		builder.push(264, 0, 7, 2);
		builder.push(281, 0, 7, 2);
		builder.push(283, 0, 15, 2);
		builder.push(296, 0, 7, 2);
		builder.push(298, 0, 15, 2);
		builder.push(313, 0, 7, 2);
		builder.push(315, 0, 7, 2);
		builder.push(326, 0, 12, 0);
		builder.push(329, 0, 14, 1);
		builder.push(333, 0, 10, 0);
		builder.push(334, 0, 10, 0);
		builder.push(337, 0, 11, 1);
		builder.push(344, 0, 17, 0);
		builder.push(347, 0, 19, 1);
		builder.push(363, 0, 8, 2);
		builder.push(365, 0, 8, 2);
		builder.push(367, 0, 8, 2);
		builder.push(369, 0, 14, 2);
		builder.push(371, 0, 23, 2);
		builder.push(375, 0, 7, 0);
		builder.push(386, 0, 7, 2);
		builder.push(393, 0, 7, 2);
		builder.push(404, 0, 7, 2);
		builder.push(406, 0, 17, 0);
		builder.push(409, 0, 19, 1);
		builder.push(422, 0, 7, 2);
		builder.push(429, 0, 13, 1);
		builder.push(435, 0, 7, 2);
		builder.push(440, 0, 13, 1);
		builder.push(451, 0, 10, 1);
		builder.push(457, 0, 7, 2);
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
