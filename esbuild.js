/* eslint-disable no-undef */
import { copy } from "esbuild-plugin-copy";
import esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ["client/src/extension.ts", "server/src/server.ts"],
		bundle: true,
		format: "cjs",
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: "node",
		outdir: "dist",
		external: ["vscode", "electron-edge-js", "edge-cs"],
		logLevel: "warning",
		plugins: [
			esbuildProblemMatcherPlugin,
			copy({
				assets: {
					from: ["./server/src/external/*"],
					to: ["./server/src/external"]
				},
				watch: true
			}),
			copy({
				assets: {
					from: ["./server/src/resources/**/*"],
					to: ["./server/src/resources"]
				},
				watch: true
			}),
			copy({
				assets: {
					from: ["./client/src/media/**/*"],
					to: ["./client/src/media"]
				},
				watch: true
			}),
			copy({
				assets: {
					from: ["./media/**/*"],
					to: ["./media"]
				},
				watch: true
			}),
			copy({
				assets: {
					from: ["./node_modules/electron-edge-js/**/*"],
					to: ["./node_modules/electron-edge-js"]
				}
			}),
			copy({
				assets: {
					from: ["./node_modules/edge-cs/**/*"],
					to: ["./node_modules/edge-cs"]
				}
			})
		]
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started");
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				if (location == null) return;
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log("[watch] build finished");
		});
	}
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
