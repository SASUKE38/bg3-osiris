import { TextDocument } from "vscode-languageserver-textdocument";
import { AliasTypeNode, ASTNode, ASTNodeKind, EnumTypeNode } from "../../parser/ast/nodes";
import { HeaderLexer } from "../../parser/lexer/headerLexer";
import { HeaderParser } from "../../parser/parser/headerParser";
import { Resource, ResourceKind } from "./resource";
import { Mod } from "../mod";
import { encodePath } from "../../utils/pathUtils";
import { readFileSync } from "fs";

export class HeaderResource extends Resource {
	readonly kind: ResourceKind = ResourceKind.Header;
	protected document: TextDocument;
	private readonly types = new Set<string>();
	private readonly enums = new Map<string, string[]>();

	constructor(mod: Mod, name: string, path: string) {
		super(mod, name, path);
		this.document = TextDocument.create(encodePath(path), "", 1, readFileSync(path, { encoding: "utf-8" }));
	}

	async load(): Promise<ASTNode | undefined> {
		if (!this.isValid()) {
			const parser = new HeaderParser(new HeaderLexer(this.document).tokenize());
			const root = parser.parse();

			this.ast = root;
			this.diagnostics = parser.diagnostics;
			this.types.clear();
			this.enums.clear();
			root.types.forEach((value) => {
				if (value.kind === ASTNodeKind.ALIAS_TYPE_NODE) {
					this.types.add((value as AliasTypeNode).value);
				} else if (value.kind === ASTNodeKind.ENUM_TYPE_NODE) {
					this.enums.set((value as EnumTypeNode).type, (value as EnumTypeNode).members);
				}
			});

			this.validate();
		}

		return this.ast;
	}
}
