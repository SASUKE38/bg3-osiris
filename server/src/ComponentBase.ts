import { Connection } from 'vscode-languageserver';
import { Server } from './server';

export class ComponentBase {
	readonly server: Server;

	constructor(server: Server) {
		this.server = server;
	}


	initialize(connection: Connection) {}
}