import { Connection, ServerCapabilities } from "vscode-languageserver";
import { Server } from "./server";

export abstract class ComponentBase {
	readonly server: Server;

	constructor(server: Server) {
		this.server = server;
	}

	/**
	 * Installs this component's handlers for the given connection.
	 *
	 * @param connection The connection to the client.
	 */
	initializeComponent?(connection: Connection): void;

	/**
	 * Returns the capabilities of this server component as specified in the Language
	 * Server Protocol (LSP) documentation.
	 *
	 * @returns A {@link Partial} instance of a {@link ServerCapabilities} that contains this component's capabilities.
	 */
	abstract getCapabilities(): Partial<ServerCapabilities>;
}
