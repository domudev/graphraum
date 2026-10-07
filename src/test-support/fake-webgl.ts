/**
 * Node-only stand-ins for the DOM and WebGLRenderer so `Graphraum` can run its CPU paths
 * (compile, materialize, incremental patches) in Vitest. Nothing here draws pixels:
 * use it for deterministic buffer assertions and CPU measurements, never for visual claims.
 */

const noop = () => undefined;

class FakeEventTarget {
	addEventListener = noop;
	removeEventListener = noop;
}

export class FakeElement extends FakeEventTarget {
	readonly style: Record<string, string> = {};
	readonly ownerDocument = new FakeEventTarget();
	clientHeight: number;
	clientWidth: number;

	constructor(width = 800, height = 600) {
		super();
		this.clientWidth = width;
		this.clientHeight = height;
	}

	append = noop;
	remove = noop;
	getRootNode() {
		return this.ownerDocument;
	}
	getBoundingClientRect() {
		return {
			bottom: this.clientHeight,
			height: this.clientHeight,
			left: 0,
			right: this.clientWidth,
			top: 0,
			width: this.clientWidth,
		};
	}
	setPointerCapture = noop;
	releasePointerCapture = noop;
}

/** Replaces `three`'s WebGLRenderer: keeps the API surface Graphraum touches, renders nothing. */
export class FakeWebGLRenderer {
	readonly domElement = new FakeElement();
	readonly info = { memory: { geometries: 0, textures: 0 }, render: { calls: 0 } };
	dispose = noop;
	getContext() {
		return {};
	}
	render = noop;
	setClearColor = noop;
	setPixelRatio = noop;
	setSize = noop;
}

class FakeResizeObserver {
	disconnect = noop;
	observe = noop;
	unobserve = noop;
}

/** Installs the browser globals Graphraum reads. Animation frames are never run. */
export function installFakeBrowserGlobals(stub: (name: string, value: unknown) => void) {
	stub("window", { devicePixelRatio: 1 });
	stub("ResizeObserver", FakeResizeObserver);
	stub("requestAnimationFrame", () => 1);
	stub("cancelAnimationFrame", noop);
}
