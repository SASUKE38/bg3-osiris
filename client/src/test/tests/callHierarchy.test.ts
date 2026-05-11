import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Call Hierarchy Provider", () => {
	const docUri = getDocUri("Act3c_EPI_Emperor.txt");

	suite("Prepare Call Hierarchy", () => {
		test("Preparing a call hierarchy for a signature should return call hierarchy items", async () => {
			await testPrepareCallHierarchy(docUri, new vscode.Position(228, 11), [
				{
					name: "QRY_EPI_Epilogue_EmperorRootLetterIsValid",
					kind: vscode.SymbolKind.Function,
					uri: docUri,
					range: toRange(228, 0, 228, 63),
					selectionRange: toRange(228, 0, 228, 41)
				}
			]);
		});

		test("Preparing a call hierarchy for a whitespace should return nothing", async () => {
			await testPrepareCallHierarchy(docUri, new vscode.Position(449, 0), []);
		});
	});

	suite("Incoming Calls", () => {
		test("Requesting incoming calls for a signature with callers should get an array of its callers");

		test("Requesting incoming calls for a signature with no callers should get an empty array");
	});

	suite("Outgoing Calls", () => {
		test("Requesting outgoing calls for a signature with calls should get an array of its calls");

		test("Requesting outgoing calls for a signature with no calls should get an empty array");
	});
});

async function testPrepareCallHierarchy(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCallHierarchyItemList: vscode.CallHierarchyItem[]
) {
	await activate(docUri);

	const actualCallHierarchyItemList = (await vscode.commands.executeCommand(
		"vscode.prepareCallHierarchy",
		docUri,
		position
	)) as vscode.CallHierarchyItem[];

	assert.ok(actualCallHierarchyItemList.length === expectedCallHierarchyItemList.length);
	expectedCallHierarchyItemList.forEach((expectedItem, i) => {
		assert.strictEqual(actualCallHierarchyItemList[i].name, expectedItem.name);
		assert.strictEqual(actualCallHierarchyItemList[i].kind, expectedItem.kind);
		assert.strictEqual(actualCallHierarchyItemList[i].uri.toString(), expectedItem.uri.toString());
		assert.deepStrictEqual(actualCallHierarchyItemList[i].range, expectedItem.range);
		assert.deepStrictEqual(actualCallHierarchyItemList[i].selectionRange, expectedItem.selectionRange);
	});
}

async function testIncomingCalls() {}

async function testOutgoingCalls() {}
