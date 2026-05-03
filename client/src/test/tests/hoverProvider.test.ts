import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "../helper";

suite("Hover Provider", () => {
	const docUri = getDocUri("Act3c_EPI_Emperor.txt");
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
		await testHover(docUri, new vscode.Position(91, 8), 1, [
			{ contents: [expectedString], range: toRange(91, 0, 91, 14) }
		]);
	});

	test("Hover over left edge of builtin name should display wiki info", async () => {
		const expectedString = new vscode.MarkdownString(
			"```osiris\n" +
				"query GetFlag([in](FLAG)_Flag, [in](GUIDSTRING)_Object, [out](INTEGER)_FlagState)\n" +
				"```\n"
		);
		expectedString.appendMarkdown(descriptionHeader + "\n");
		expectedString.appendMarkdown(
			"Returns whether _Flag is currently set on _Object (a character or an item).  \n"
		);
		expectedString.appendMarkdown(examplesHeader);
		expectedString.appendCodeblock(
			'PROC\nPROC_Hirelings_CheckDecreaseInCampCounter((CHARACTER)_Hireling)\nAND\nGetFlag(_Hireling_State_InCamp, _Hireling, 1)\nTHEN\nPROC_DecreaseCounter("Hirelings_InCamp_Count");\n',
			languageId
		);
		expectedString.appendMarkdown(seeAlsoHeader + "\n- FlagSet\n- FlagCleared");
		await testHover(docUri, new vscode.Position(114, 0), 1, [
			{ contents: [expectedString], range: toRange(114, 0, 114, 7) }
		]);
	});

	test("Hover over right edge of builtin name should display wiki info", async () => {
		const expectedString = new vscode.MarkdownString(
			"```osiris\n" +
				"event KilledBy((CHARACTER)_Defender, (GUIDSTRING)_AttackerOwner, (GUIDSTRING)_Attacker, (INTEGER)_StoryActionID)\n" +
				"```\n"
		);
		expectedString.appendMarkdown(descriptionHeader + "\n");
		expectedString.appendMarkdown(
			"Thrown when a character is killed by another game object.  \n  #### Further Information  \n_AttackerOwner can be the same as _Attacker. _AttackOwner will be different in case of summoned characters, or in case of items.  If the attacker is unknown, this event will not be thrown (i.e. _Attacker will never be NULL).  \n"
		);
		expectedString.appendMarkdown(examplesHeader);
		expectedString.appendCodeblock(
			'IF\nKilledBy(_Surgeon, _Killer, _, _)\nAND\nDB_PartyMembers(_Killer)\nAND\nNOT_AchievementBlocked(1)\nTHEN\nPROC_Achievements_Unlock("BG3_Quest34");\n',
			languageId
		);
		expectedString.appendMarkdown(seeAlsoHeader + "\n- AttackedBy\n- MissedBy\n- CriticalHitBy");
		await testHover(docUri, new vscode.Position(202, 8), 1, [
			{ contents: [expectedString], range: toRange(202, 0, 202, 8) }
		]);
	});

	test("Hover over builtin parameter should display nothing", async () => {
		await testHover(docUri, new vscode.Position(199, 37), 0, [{ contents: [] }]);
	});

	test("Hover over builtin type should display nothing", async () => {
		await testHover(docUri, new vscode.Position(178, 27), 0, [{ contents: [] }]);
	});

	test("Hover over empty line should display nothing", async () => {
		await testHover(docUri, new vscode.Position(182, 0), 0, [{ contents: [] }]);
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
				assert.strictEqual(
					(actualItem.contents[i] as vscode.MarkdownString).value,
					(expectedItem.contents[i] as vscode.MarkdownString).value
				);
			}
			assert.deepStrictEqual(actualItem.range, expectedItem.range);
		}
	});
}
