import { Position, Range } from "vscode-languageserver";

export function rangeContainsPosition(range: Range, position: Position): boolean {
	return (
		range.start.line <= position.line &&
		range.end.line >= position.line &&
		range.start.character <= position.character &&
		range.end.character >= position.character
	);
}

export function rangeEquals(rangeA: Range, rangeB: Range): boolean {
	return (
		rangeA.end.character === rangeB.end.character &&
		rangeA.end.line === rangeB.end.line &&
		rangeA.start.character === rangeB.start.character &&
		rangeA.start.line === rangeB.start.line
	);
}
