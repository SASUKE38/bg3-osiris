import { normalize, sep } from "path";

export function decodePath(path: string) {
	return trimFilePrefix(decodeURIComponent(path));
}

export function encodePath(path: string) {
	return `file:///${encodeURIComponent(path.replaceAll(/\\/g, "/"))}`;
}

export function trimFilePrefix(path: string) {
	if (path.startsWith("file:///")) {
		path = path.substring(8);
	}
	return normalize(path);
}

export function replaceFinalPathPart(path: string, targetName: string): string {
	const pathElements = path.split(sep);
	pathElements[pathElements.length - 1] = `${targetName}.txt`;
	return pathElements.join(sep);
}
