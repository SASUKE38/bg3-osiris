process.env.EDGE_USE_CORECLR = "1";
import * as edge from "electron-edge-js";
import { join } from "path";

const extractFromPakCall = edge.func({
	assemblyFile: join(__dirname, "..", "external", "BG3OsirisReader.dll"),
	typeName: "BG3OsirisReader.PackageExtractor",
	methodName: "Invoke"
});

export async function extractFromPak(packagePath: string, fileName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		extractFromPakCall({ packagePath: packagePath, fileName: fileName }, function (error, result) {
			if (error) reject(error);
			else resolve(result as string);
		});
	});
}
