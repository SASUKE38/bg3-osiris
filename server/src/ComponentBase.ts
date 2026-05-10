import { Connection, ServerCapabilities } from "vscode-languageserver";
import { Server } from "./server";

export abstract class ComponentBase {
	readonly server: Server;

	constructor(server: Server) {
		this.server = server;
	}

	initializeComponent?(connection: Connection): void;

	abstract getCapabilities(): Partial<ServerCapabilities>;
}
