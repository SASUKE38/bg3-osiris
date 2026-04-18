import { normalize } from "path";

export function trimFilePrefix(path: string) {
	if (path.startsWith("file:///")) {
		path = path.substring(8);
	}
	return normalize(path);
}
