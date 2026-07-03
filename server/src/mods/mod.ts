import { ModMetaModuleInfo, ModMetaModuleShortDesc } from "./modMeta";
import { readdirSync, rmSync } from "fs";
import { StoryTree } from "./storyTree";
import { GoalResource } from "./resource/goalResource";
import { join } from "path";
import { extractFromPak } from "../utils/edge";
import { ModManager } from "../components/modManager";
import { readdir } from "fs/promises";
import { Resource } from "./resource/resource";
import { Dependency } from "./dependency";
import { FunctionSignature } from "./story";

interface InheritedGoal {
	name: string;
	owner: string;
	parents: string[];
	children: string[];
	definedSignatures: FunctionSignature[];
}

interface InheritedDatabase {
	name: string;
	parameters: string[];
}

export interface DependencyInitializationData {
	uuid: string;
	path: string;
	internalPath: string;
}

export interface DependencyMetaCollectionEntry {
	path: string;
	internalPath: string;
	meta?: ModMetaModuleInfo;
}

export class Mod {
	readonly meta?: ModMetaModuleInfo;
	readonly manager: ModManager;
	private readonly goals: GoalResource[] = [];
	private readonly goalSubdirectory = join("Story", "RawFiles", "Goals");
	private readonly types = new Set<string>();
	private readonly enums = new Map<string, string[]>();
	private readonly inheritedGoals = new Map<string, InheritedGoal>();
	private readonly inheritedDatabases = new Map<string, InheritedDatabase>();
	private readonly inheritedIgnoredOrphans = new Set<string>();
	private readonly inheritedFoundOrphans = new Set<string>();
	private path: string;
	private dependencies: Dependency[] = [];
	storyTree = new StoryTree();

	constructor(path: string, manager: ModManager, meta?: ModMetaModuleInfo) {
		this.path = path;
		this.manager = manager;
		this.meta = meta;
	}

	/**
	 * Initializes this {@link Mod}.
	 */
	async initialize() {
		for (const file of await readdir(join(this.path, this.goalSubdirectory))) {
			if (this.path) {
				this.goals.push(new GoalResource(this, file, join(this.path, this.goalSubdirectory, file)));
			}
		}

		this.initializeDependencies();
	}

	private async initializeDependencies() {
		if (!this.meta) return;

		const dependencies = await Promise.all(
			(await this.findDependencies(this.meta)).map(async (dependencyData) => {
				const dependency = new Dependency(dependencyData);
				await dependency.initialize();
				this.mergeStory(dependency);
				return dependency;
			})
		);
		this.dependencies.push(...dependencies);
	}

	private mergeStory(dependency: Dependency) {
		const { story } = dependency;
		if (!story) return;

		Object.values(story.types).forEach((value) => this.types.add(value.Name));

		Object.values(story.enums).forEach((value) => {
			this.enums.set(
				story.types[value.UnderlyingType].Name,
				value.Elements.map((element) => element.Name)
			);
		});

		// TODO: Delete unused signatures?
		Object.values(Array.from(dependency.activeGoals.keys())).forEach((key) => {
			const goal = story.goals[key];
			const definedSignatures = dependency.definedSignatures.get(goal.Name);
			this.inheritedGoals.set(goal.Name, {
				name: goal.Name,
				owner: dependency.path,
				parents: goal.ParentGoals.map((parent) => story.goals[parent.Index].Name),
				children: goal.SubGoals.map((child) => story.goals[child.Index].Name),
				definedSignatures: definedSignatures ? Array.from(definedSignatures.values()).flat(1) : []
			});
		});

		Object.values(story.databases).forEach((value) => {
			this.inheritedDatabases.set(value.OwnerNode.Name, {
				name: value.OwnerNode.Name,
				parameters: Array.from(value.Parameters.Types).map((parameter) => story.types[parameter].Name)
			});
		});

		dependency.ignoredOrphans.forEach((value) => this.inheritedIgnoredOrphans.add(value));
		dependency.foundOrphans.forEach((value) => this.inheritedFoundOrphans.add(value));
	}

	getResource(path: string): Resource | undefined {
		return this.goals.find((file) => file.path === path);
	}

	getAllGoals(): GoalResource[] {
		return this.goals;
	}

	/**
	 * Gets a collection of paths to the mod's dependencies.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod whose dependencies should be loaded.
	 * @returns A list of {@link DependencyInitializationData} indicating the locations of the mod's dependencies.
	 */
	private async findDependencies(meta: ModMetaModuleInfo): Promise<DependencyInitializationData[]> {
		const res: DependencyInitializationData[] = [];
		if (!meta.dependencies) return res;

		const files: string[] = (
			(await this.manager.server.connection.workspace.getConfiguration("bg3Osiris.dependencyPaths")) as string[]
		)
			.map((value) => {
				return readdirSync(value).map((path) => {
					return join(value, path);
				});
			})
			.flat(1);

		const metaCollection = new Map<string, DependencyMetaCollectionEntry>();

		for (const file of files) {
			if (!file.endsWith(".pak")) continue;

			const pakMetas = await extractFromPak(file, "meta.lsx");

			for (let i = 0; i < pakMetas.OutputPaths.length; i++) {
				const pakMeta = pakMetas.OutputPaths[i];
				const internalPath = pakMetas.Files[i].split("/");
				internalPath.pop();

				const moduleInfo = this.manager.readModMeta(pakMeta);
				if (moduleInfo)
					metaCollection.set(moduleInfo.uuid, {
						path: file,
						internalPath: internalPath ? internalPath.join("/") : "",
						meta: moduleInfo
					});
				rmSync(pakMeta);
			}
		}

		function doSearch(dependencies: ModMetaModuleShortDesc[]) {
			for (const dependency of dependencies) {
				if (!metaCollection.has(dependency.uuid)) {
					console.error(`Couldn't find dependency ${dependency.name} for ${meta.name}`);
					continue;
				}
				const metaEntry = metaCollection.get(dependency.uuid) as DependencyMetaCollectionEntry;
				if (metaEntry.meta?.dependencies) doSearch(metaEntry.meta.dependencies);

				res.push({ uuid: dependency.uuid, path: metaEntry.path, internalPath: metaEntry.internalPath });
			}
		}

		doSearch(meta.dependencies);
		
		return res;
	}
}
