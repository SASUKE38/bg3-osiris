import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Definitions Provider", async () => {
	const epiDocUri = getDocUri("Act3c_EPI_Emperor.txt");
	const endDocUri = getDocUri("Act3c_END_Emperor.txt");

	test("Finding definitions of a variable should get first reference of the variable in the rule", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(315, 92), [
			{ uri: epiDocUri, range: toRange(311, 22, 311, 29) }
		]);
	});

	test("Finding definitions of a user-defined, non-database signature should get all implementations of the signature in the workspace", async () => {
		await testDefinitions(endDocUri, new vscode.Position(157, 25), [
			{ uri: endDocUri, range: toRange(157, 0, 157, 41) },
			{ uri: epiDocUri, range: toRange(260, 0, 260, 41) },
			{ uri: epiDocUri, range: toRange(275, 0, 275, 41) },
			{ uri: epiDocUri, range: toRange(290, 0, 290, 41) }
		]);
	});

	test("Finding definitions of a builtin signature should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(283, 6), []);
	});

	test("Finding definitions of a database should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(42, 17), []);
	});

	test("Finding definitions of a constant should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(253, 66), []);
	});

	test("Finding definitions of a number should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(96, 50), []);
	});

	test("Finding definitions of a string should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(283, 36), []);
	});

	test("Finding definitions of an enum should do nothing", async () => {
		await testDefinitions(endDocUri, new vscode.Position(95, 92), []);
	});

	test("Finding definitions of whitespace should do nothing", async () => {
		await testDefinitions(epiDocUri, new vscode.Position(288, 0), []);
	});
});

async function testDefinitions(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedDefinitionList: vscode.Location[]
) {
	await activate(docUri);

	const actualDefinitionList = (await vscode.commands.executeCommand(
		"vscode.executeDefinitionProvider",
		docUri,
		position
	)) as vscode.Location[];

	assert.ok(actualDefinitionList.length === expectedDefinitionList.length);
	expectedDefinitionList.forEach((location, i) => {
		assert.strictEqual(actualDefinitionList[i].uri.toString(), location.uri.toString());
		assert.deepStrictEqual(actualDefinitionList[i].range, location.range);
	});
}
