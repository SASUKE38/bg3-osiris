process.env.EDGE_USE_CORECLR = "1";
import * as edge from "electron-edge-js";
import { join } from "path";
import { Story } from "../mods/story";

const extractFromPakCall = edge.func({
	assemblyFile: join(__dirname, "..", "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.PackageExtractor",
	methodName: "Extract"
});

export async function extractFromPak(packagePath: string, fileName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		extractFromPakCall({ packagePath, fileName }, function (error, result) {
			if (error) reject(error);
			else resolve(result as string);
		});
	});
}

const extractStoryCall = edge.func({
	assemblyFile: join(__dirname, "..", "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.StoryExtractor",
	methodName: "Invoke"
});

export async function extractStory(storyPath: string): Promise<Story> {
	return new Promise((resolve, reject) => {
		extractStoryCall(storyPath, function (error, result) {
			if (error) reject(error);
			else resolve(result as Story);
		});
	});
}

const extractPathsInPackageCall = edge.func({
	assemblyFile: join(__dirname, "..", "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.PackageExtractor",
	methodName: "GetPaths"
});

export async function extractPathsInPackage(packagePath: string, filter: string): Promise<string[]> {
	return new Promise((resolve, reject) => {
		extractPathsInPackageCall({ packagePath, filter }, function (error, result) {
			if (error) reject(error);
			else resolve(result as string[]);
		});
	});
}
