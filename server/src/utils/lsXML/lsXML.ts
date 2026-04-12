import { XMLParser } from "fast-xml-parser";
import { PathOrFileDescriptor, readFileSync } from 'fs';

export interface LSXMLFile {
	save: LSXMLSave;
}

export interface LSXMLSave {
	version: LSXMLVersion[] | LSXMLVersion;
	region: LSXMLRegion[] | LSXMLRegion;
}

export interface LSXMLVersion {
	attributes: {
		major: string;
		minor: string;
		revision: string;
		build: string;
	};
}

export interface LSXMLRegion {
	attributes: {
		id: string;
	};
	node: LSXMLNode[] | LSXMLNode;
}

export interface LSXMLNode {
	attributes: {
		id: string;
	};
	attribute?: LSXMLAttribute[] | LSXMLAttribute;
	children?: {
		node: LSXMLNode[] | LSXMLNode;
	};
}

export interface LSXMLAttribute {
	attributes: {
		id: string;
		type: string;
		value: string;
	};
}

const uniqueAttributeNames: Map<string, string> = new Map<string, string>([
	["MD5", "md5"],
	["UUID", "uuid"]
]);

export function ParseLSXML(parser: XMLParser, path: PathOrFileDescriptor): any {
	return parser.parse(readFileSync(path, { encoding: "utf-8" }));
}

export function LSXMLParserFactory(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "",
		attributesGroupName: "attributes"
	});
}

export function findNodeChild(parent: LSXMLNode | undefined, target: string): LSXMLNode | undefined {
	if (!parent) return undefined;
	if (Array.isArray(parent.children?.node)) {
		return parent.children.node.find((child) => {
			return child.attributes.id == target;
		});
	} else if (parent.children?.node.attributes.id == target) {
		return parent.children.node;
	} else if (parent.attributes.id == target) {
		return parent;
	} else {
		return undefined;
	}
}

export function findRegionChild(region: LSXMLRegion | undefined, target: string): LSXMLNode | undefined {
	if (!region) return undefined;
	if (Array.isArray(region.node)) {
		return region.node.find((child) => {
			return child.attributes.id == target;
		});
	} else if (region.node.attributes.id == target) {
		return region.node;
	} else if (region.attributes.id == target) {
		return region;
	} else {
		return undefined;
	}
}

export function findRegion(file: LSXMLFile, target: string): LSXMLRegion | undefined {
	const { region } = file.save;
	if (Array.isArray(region)) {
		return region.find((child) => {
			return child.attributes.id == target;
		});
	} else if (region.attributes.id == target) {
		return region;
	} else {
		return undefined;
	}
}

export function getNodeChildren(parent: LSXMLNode | undefined): LSXMLNode[] {
	const children = parent?.children;
	if (children) {
		return Array.isArray(children.node) ? children.node : [children.node];
	} else {
		return [];
	}
}

export function collectAttributes<T>(node: LSXMLNode): T {
	const res: Record<string, unknown> = {};
	if (node.attribute) {
		if (Array.isArray(node.attribute)) {
			for (const { attributes } of node.attribute) {
				Object.defineProperty(
					res,
					convertAttributeId(attributes.id),
					getAttrubtePropertyDescriptor(attributes.value)
				);
			}
		} else {
			Object.defineProperty(
				res,
				convertAttributeId(node.attribute.attributes.id),
				getAttrubtePropertyDescriptor(node.attribute.attributes.value)
			);
		}
	}
	return res as T;
}

function getAttrubtePropertyDescriptor(value: string): PropertyDescriptor {
	return { value: value, configurable: true, enumerable: true, writable: true };
}

function convertAttributeId(id: string): string {
	const mapName = uniqueAttributeNames.get(id);
	return mapName ? mapName : id.substring(0, 1).toLowerCase() + id.substring(1);
}
