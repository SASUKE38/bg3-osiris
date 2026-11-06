import "./edgeEnv";
import * as edge from "electron-edge-js";
import { join } from "path";
import { Story } from "../mods/story";

const extractFromPakCall = edge.func({
	assemblyFile: join(__dirname, "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.PackageExtractor",
	methodName: "Extract"
});

export interface ExtractFromPakResult {
	OutputPaths: string[];
	Files: string[];
}

export async function extractFromPak(packagePath: string, fileName: string): Promise<ExtractFromPakResult> {
	return new Promise<ExtractFromPakResult>((resolve, reject) => {
		extractFromPakCall({ packagePath, fileName }, function (error, result) {
			if (error) reject(error);
			else resolve(result as ExtractFromPakResult);
		});
	});
}

const extractStoryCall = edge.func({
	assemblyFile: join(__dirname, "external", "BG3OsirisReader.dll"),
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
	assemblyFile: join(__dirname, "external", "BG3OsirisReader.dll"),
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

const getGoalContentCall = edge.func({
	assemblyFile: join(__dirname, "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.PackageExtractor",
	methodName: "ExtractGoalText"
});

export async function getGoalContent(osiPath: string, goalId: number): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		getGoalContentCall({ osiPath, goalId }, function (error, result) {
			if (error) reject(error);
			else resolve(result as Uint8Array);
		});
	});
}
