import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Should do hover", () => {
	const docUri = getDocUri("hover.txt");
	const languageId = "osiris";
	const descriptionHeader = "### Description";
	const examplesHeader = "### Examples";
	const seeAlsoHeader = "### See Also  ";

	test("Hover over builtin should display wiki info", async () => {
		const expectedString = new vscode.MarkdownString(
			"```osiris\n" + "call ObjectSetTitle((GUIDSTRING)_Object, (STRING)_LocalizedTextKey)\n" + "```\n"
		);
		expectedString.appendMarkdown(descriptionHeader + "\n");
		expectedString.appendMarkdown(
			"Set the title of _Object to _LocalizedTextKey that is defined in the Translated Strings Editor.  \n"
		);
		expectedString.appendMarkdown(examplesHeader);
		expectedString.appendCodeblock(
			'IF\nFlagSet(_State_AfterCeremony, _, _)\nTHEN\nSetFlag((FLAG)_State_GortashBecameArchduke);\nObjectSetTitle(_Gortash, "GortashAfterCeremony");\n',
			languageId
		);
		expectedString.appendMarkdown(
			seeAlsoHeader + "\n- ObjectGetTitle\n- ObjectSetTitleHidden\n- SetStoryDisplayName"
		);
		await testHover(docUri, new vscode.Position(18, 8), 1, [
			{ contents: [expectedString], range: toRange(18, 0, 18, 14) }
		]);
	});
	
	test("Hover over empty line should display nothing", async () => {
		await testHover(docUri, new vscode.Position(9, 0), 0, [{ contents: [] }]);
	});

});

async function testHover(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedLength: number,
	expectedHoverList: vscode.Hover[]
) {
	await activate(docUri);

	const actualHoverList = (await vscode.commands.executeCommand(
		"vscode.executeHoverProvider",
		docUri,
		position
	)) as vscode.Hover[];

	expectedHoverList.forEach((expectedItem, i) => {
		const actualItem = actualHoverList[i];
		assert.ok(actualHoverList.length === expectedLength);
		if (expectedLength > 0) {
			for (let i = 0; i < actualHoverList.length; i++) {
				assert.equal(
					(actualItem.contents[i] as vscode.MarkdownString).value,
					(expectedItem.contents[i] as vscode.MarkdownString).value
				);
			}
			assert.deepEqual(actualItem.range, expectedItem.range);
		}
	});
}
