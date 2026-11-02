import { ModMetaModuleInfo, ModMetaModuleShortDesc } from "./modMeta";
import { existsSync, readdirSync, rmSync } from "fs";
import { StoryTree } from "./storyTree";
import { GoalResource } from "./resource/goalResource";
import { join } from "path";
import { extractFromPak } from "../utils/edge";
import { ModManager } from "../components/modManager";
import { readdir } from "fs/promises";
import { Dependency } from "./dependency";
import { FunctionSignature } from "./story";
import { Signature, SignatureCollection } from "./signature";
import { HeaderResource } from "./resource/headerResource";

export interface InheritedType {
	name: string;
	alias: string;
	isBuiltin: boolean;
}

export interface InheritedEnum {
	underlyingType: string;
	members: string[];
}

export interface InheritedGoal {
	name: string;
	owner: Dependency;
	parents: string[];
	children: string[];
	definedSignatures: FunctionSignature[];
}

export interface DependencyMetaCollectionEntry {
	path: string;
	internalPath: string;
	meta?: ModMetaModuleInfo;
}

export class Mod {
	readonly meta?: ModMetaModuleInfo;
	readonly manager: ModManager;
	readonly headerSubdirectory = join("Story", "RawFiles");
	readonly goalSubdirectory = join(this.headerSubdirectory, "Goals");
	readonly goals: GoalResource[] = [];
	readonly inheritedGoals = new Map<string, InheritedGoal>();
	readonly inheritedSignatures = new SignatureCollection();
	readonly inheritedDatabases = new SignatureCollection();
	readonly inheritedIgnoredOrphans = new Set<string>();
	readonly inheritedFoundOrphans = new Set<string>();
	readonly inheritedTypes = new Map<string, InheritedType>();
	readonly inheritedEnums = new Map<string, InheritedEnum>();
	header?: HeaderResource;
	dependencies: Dependency[] = [];
	storyTree = new StoryTree(this);
	path: string;

	constructor(path: string, manager: ModManager, meta?: ModMetaModuleInfo) {
		this.path = path;
		this.manager = manager;
		this.meta = meta;

		const headerPath = join(this.path, this.headerSubdirectory, "story_header.div");
		if (existsSync(headerPath)) {
			this.header = new HeaderResource(this, "story_header.div", headerPath);
		}
	}

	//#region Loading

	/**
	 * Initializes this {@link Mod}.
	 */
	async initialize() {
		await this.initializeDependencies();

		for (const file of await readdir(join(this.path, this.goalSubdirectory))) {
			if (this.path) {
				await this.createGoalResource(file, join(this.path, this.goalSubdirectory, file));
			}
		}

		this.storyTree.createTree(this.goals, this.dependencies);
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

		// TODO: Delete unused signatures?
		Object.values(Array.from(dependency.activeGoals.keys())).forEach((key) => {
			const goal = story.goals[key];
			const definedSignatures = dependency.definedSignatures.get(goal.Name);
			const filteredSignatures = definedSignatures ? Array.from(definedSignatures.values()).flat(1) : [];

			for (const signature of filteredSignatures) {
				const parameters = Array.from(signature.Name.Parameters.Types).map((value) => story.types[value].Name);
				this.inheritedSignatures.set(new Signature(signature.Name.Name, signature.Type, parameters, []));
			}

			this.inheritedGoals.set(goal.Name, {
				name: goal.Name,
				owner: dependency,
				parents: goal.ParentGoals.map((parent) => story.goals[parent.Index].Name),
				children: goal.SubGoals.map((child) => story.goals[child.Index].Name),
				definedSignatures: filteredSignatures.map((value) => value.Name)
			});
		});

		dependency.builtinSignatures.forEach((value) => {
			for (const signature of value) {
				const parameters = Array.from(signature.Name.Parameters.Types).map((value) => story.types[value].Name);
				this.inheritedSignatures.set(
					new Signature(signature.Name.Name, signature.Type, parameters, [], signature.Name.OutParamMask)
				);
			}
		});

		Object.values(story.databases).forEach((value) => {
			this.inheritedDatabases.set(
				new Signature(
					value.OwnerNode.Name,
					"Database",
					Array.from(value.Parameters.Types).map((parameter) => story.types[parameter].Name),
					[]
				)
			);
		});

		dependency.ignoredOrphans.forEach((value) => this.inheritedIgnoredOrphans.add(value));
		dependency.foundOrphans.forEach((value) => this.inheritedFoundOrphans.add(value));

		Object.values(story.types).forEach((value) => {
			this.inheritedTypes.set(value.Name, {
				name: value.Name,
				alias: story.types[value.Alias].Name,
				isBuiltin: value.IsBuiltin
			});
		});

		Object.values(story.enums).forEach((value) => {
			this.inheritedEnums.set(story.types[value.UnderlyingType].Name, {
				underlyingType: story.types[value.UnderlyingType].Name,
				members: value.Elements.map((element) => element.Name)
			});
		});
	}

	//#endregion

	getGoalResource(searchTerm: string, query: "path" | "name" = "path"): GoalResource | undefined {
		return this.goals.find((file) => file[query] === searchTerm);
	}

	removeGoalResource(searchTerm: string, query: "path" | "name" = "path") {
		const index = this.goals.findIndex((file) => file[query] === searchTerm);
		if (index >= 0) this.goals.splice(index, 1);
	}

	getAllGoals(): GoalResource[] {
		return this.goals;
	}

	getAllInheritedGoals(): Map<string, InheritedGoal> {
		return this.inheritedGoals;
	}

	getAllDependencies(): Dependency[] {
		return this.dependencies;
	}

	async createGoalResource(name: string, path: string) {
		const resource = new GoalResource(this, name, path);
		await resource.load();
		this.goals.push(resource);
		this.manager.server.diagnosticManager.handleDiagnostics(resource.getTextDocument());
		return resource;
	}

	getInheritedGoalOwner(goalName: string): Dependency | undefined {
		return this.inheritedGoals.get(goalName)?.owner;
	}

	//#region Dependency Searching

	private async getMetasFromPaks(files: string[]): Promise<Map<string, DependencyMetaCollectionEntry>> {
		const res = new Map<string, DependencyMetaCollectionEntry>();
		for (const file of files) {
			if (!file.endsWith(".pak")) continue;

			try {
				const pakMetas = await extractFromPak(file, "meta.lsx");

				for (let i = 0; i < pakMetas.OutputPaths.length; i++) {
					const pakMeta = pakMetas.OutputPaths[i];
					const internalPath = pakMetas.Files[i].split("/");
					internalPath.pop();

					const moduleInfo = this.manager.readModMeta(pakMeta);
					if (moduleInfo)
						res.set(moduleInfo.uuid, {
							path: file,
							internalPath: internalPath ? internalPath.join("/") : "",
							meta: moduleInfo
						});
					rmSync(pakMeta);
				}
			} catch (error) {
				console.error(`An error occurred while unpacking the meta.lsx file for ${file}: ${error}`);
			}
		}
		return res;
	}

	private async handleBaseMods(handledUUIDs: Set<string>): Promise<DependencyMetaCollectionEntry[]> {
		const res: DependencyMetaCollectionEntry[] = [];
		const { workspace } = this.manager.server.connection;
		const library: string = await workspace.getConfiguration("bg3Osiris.baseMods.game");
		if (library === "None") return res;

		const customLibraries: string[] = await workspace.getConfiguration("bg3Osiris.baseMods.customPaths");
		(await this.getMetasFromPaks(customLibraries)).forEach((value) => {
			res.push(value);
		});

		if (library === "Custom Only") return res;
		switch (library) {
			case "Baldur's Gate 3":
				// TODO: Add orphan files to this
				res.push({ path: join(__dirname, "resources", "libraries", "bg3.pak"), internalPath: "Mods/bg3" });
				handledUUIDs.add("ed539163-bb70-431b-96a7-f5b2eda5376b");
				handledUUIDs.add("28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8");
				handledUUIDs.add("991c9c7a-fb80-40cb-8f0d-b92d4e80e9b1");
				handledUUIDs.add("3d0c5ff8-c95d-c907-ff3e-34b204f1c630");
				break;
			default:
				break;
		}
		return res;
	}

	/**
	 * Gets a collection of paths to the mod's dependencies.
	 *
	 * @param meta The {@link ModMetaModuleInfo} of the mod whose dependencies should be loaded.
	 * @returns A list of {@link DependencyInitializationData} indicating the locations of the mod's dependencies.
	 */
	private async findDependencies(meta: ModMetaModuleInfo): Promise<DependencyMetaCollectionEntry[]> {
		const res: DependencyMetaCollectionEntry[] = [];
		if (!meta.dependencies) return res;

		const { workspace } = this.manager.server.connection;
		const files: string[] = ((await workspace.getConfiguration("bg3Osiris.dependencyPaths")) as string[])
			.map((value) => {
				return readdirSync(value).map((path) => {
					return join(value, path);
				});
			})
			.flat(1);
		const metaCollection = await this.getMetasFromPaks(files);
		const handledSet = new Set<string>();

		function doMetaSearch(dependencies: ModMetaModuleShortDesc[]) {
			for (const dependency of dependencies) {
				if (handledSet.has(dependency.uuid)) continue;
				if (!metaCollection.has(dependency.uuid)) {
					console.error(`Couldn't find dependency ${dependency.name} for ${meta.name}`);
					continue;
				}
				const metaEntry = metaCollection.get(dependency.uuid) as DependencyMetaCollectionEntry;
				if (metaEntry.meta?.dependencies) {
					doMetaSearch(metaEntry.meta.dependencies);
					handledSet.add(dependency.uuid);
				}

				res.push(metaEntry);
			}
		}

		const baseMods = await this.handleBaseMods(handledSet);
		res.push(...baseMods);

		doMetaSearch(meta.dependencies);

		return res;
	}

	//#endregion

	//#region Types

	getIntrinsicType(type: InheritedType | undefined): string {
		if (!type) return "";
		if (type.alias === "UNKNOWN") return type.name;
		else return this.getIntrinsicType(this.inheritedTypes.get(type.alias));
	}

	areAliasTypes(typeA: InheritedType, typeB: InheritedType) {
		return this.getIntrinsicType(typeA) === this.getIntrinsicType(typeB);
	}

	getIntrinsicCompatibilityType(type: InheritedType) {
		const intrinsicType = this.getIntrinsicType(type);
		switch (intrinsicType) {
			case "INTEGER":
			case "INTEGER64":
			case "FLOAT":
				return "INTEGER";
				break;
			case "STRING":
			case "GUIDSTRING":
				return "STRING";
				break;
			default:
				return "UNKNOWN";
				break;
		}
	}

	areIntrinsicTypesCompatible(typeA: InheritedType, typeB: InheritedType) {
		return this.getIntrinsicCompatibilityType(typeA) === this.getIntrinsicCompatibilityType(typeB);
	}

	isGuidToGuidCastUnrelated(typeA: InheritedType, typeB: InheritedType) {
		return (
			this.areAliasTypes(typeA, typeB) &&
			this.getIntrinsicType(typeA) === "GUIDSTRING" &&
			typeA.name !== "GUIDSTRING" &&
			typeB.name !== "GUIDSTRING" &&
			typeA.name !== typeB.name
		);
	}

	//#endregion
}
