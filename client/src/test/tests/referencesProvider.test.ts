import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("References Provider", () => {
	const docUri = getDocUri("Act3c_EPI_Emperor.txt");

	suite("References", () => {
		test("Finding references of constant should get all instances of the constant in the workspace", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of signature should get all instances of the signature in the workspace", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of variable should get all instances of the variable in the containing rule", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of number should get no references", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of string should get no references", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of enum should get no references", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});

		test("Finding references of type should get no references", async () => {
			await testReferences(docUri, new vscode.Position(0, 0), []);
		});
	});

	suite("Document Highlight", () => {
		test("Cursor on constant should highlight all instances of the constant in the document", async () => {
			await testDocumentHighlight(docUri, new vscode.Position(24, 64), [
				{ range: toRange(24, 27, 24, 95), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(25, 26, 25, 94), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(356, 38, 356, 106), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on left edge of signature should highlight all instances of the signature in the document", async () => {
			await testDocumentHighlight(docUri, new vscode.Position(8, 0), [
				{ range: toRange(6, 5, 6, 39), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(7, 0, 7, 34), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(8, 0, 8, 34), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(226, 0, 226, 34), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on right edge of signature should highlight all instances of the signature in the document", async () => {
			await testDocumentHighlight(docUri, new vscode.Position(15, 43), [
				{ range: toRange(15, 2, 15, 43), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(16, 0, 16, 41), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(239, 0, 239, 41), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on variable should highlight instances of the variable in rule in the document", async () => {
			await testDocumentHighlight(docUri, new vscode.Position(90, 28), [
				{ range: toRange(84, 39, 84, 46), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(90, 25, 90, 32), kind: vscode.DocumentHighlightKind.Text },
				{ range: toRange(91, 15, 91, 22), kind: vscode.DocumentHighlightKind.Text }
			]);
		});

		test("Cursor on whitespace should highlight nothing", async () => {
			await testDocumentHighlight(docUri, new vscode.Position(178, 22), []);
		});
	});
});

async function testReferences(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedLocationList: vscode.Location[]
) {
	await activate(docUri);

	const actualLocationList = (await vscode.commands.executeCommand(
		"vscode.executeReferenceProvider",
		docUri,
		position
	)) as vscode.Location[];

	assert.deepStrictEqual(actualLocationList, expectedLocationList);
}

async function testDocumentHighlight(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedHighlightList: vscode.DocumentHighlight[]
) {
	await activate(docUri);

	const actualHighlightList = (await vscode.commands.executeCommand(
		"vscode.executeDocumentHighlights",
		docUri,
		position
	)) as vscode.DocumentHighlight[];

	assert.ok(actualHighlightList.length === expectedHighlightList.length);
	expectedHighlightList.forEach((expectedHighlight, i) => {
		assert.deepStrictEqual(actualHighlightList[i].range, expectedHighlight.range);
		assert.strictEqual(actualHighlightList[i].kind, expectedHighlight.kind);
	});
}
