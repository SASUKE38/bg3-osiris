import { Position, Range } from "vscode-languageserver";

export function rangeContainsPosition(range: Range, position: Position): boolean {
	return (
		range.start.line <= position.line &&
		range.end.line >= position.line &&
		range.start.character <= position.character &&
		range.end.character >= position.character
	);
}
