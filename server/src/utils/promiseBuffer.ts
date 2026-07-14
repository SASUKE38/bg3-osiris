export class PromiseBuffer {
	private pending: { resolve: Function }[] = [];
	private ready = false;

	async waitUntilReady() {
		if (this.ready) return;
		return new Promise((resolve) => this.pending.push({ resolve }));
	}

	setReady() {
		this.ready = true;
		this.pending.forEach((value) => value.resolve());
		this.pending = [];
	}
}
