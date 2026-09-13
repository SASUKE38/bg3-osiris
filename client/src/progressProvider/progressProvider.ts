import { LanguageClient } from "vscode-languageclient/node";
import { ComponentBase } from "../componentBase";
import { ProgressLocation, window } from "vscode";
import { EventEmitter } from "events";
import { notificationModInitializing, notificationModReady } from "bg3-osiris-shared";

export class ProgressProvider extends ComponentBase {
	private readonly emitter = new EventEmitter();
	private static readonly modReadyEvent = "ProgressProvider.modReadyEvent";

	initializeComponent(connection: LanguageClient): void {
		connection.onNotification(notificationModInitializing, this.handleMakeProgress)

		connection.onNotification(notificationModReady, args =>
      		this.emitter.emit(ProgressProvider.modReadyEvent, args)
    	);
	}

	private handleMakeProgress = async () => {

		const createProgress = () => {
			const { emitter } = this;
			return new Promise<void>(resolve => {
				function onReady() {
					emitter.removeListener(ProgressProvider.modReadyEvent, onReady);
					resolve();
				}

				emitter.addListener(ProgressProvider.modReadyEvent, onReady);
			});
		}

		window.withProgress({
			location: ProgressLocation.Notification,
			title: "Mod Initializing",
			cancellable: false
		}, createProgress);
	}
}