import { Spherical, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Graphraum } from "./graphraum";

/** Minimal DOM stand-ins: the engine runs in Node, so the WebGL renderer and canvas are faked. */
const fakes = vi.hoisted(() => {
	class FakeDocument extends EventTarget {
		hidden = false;
	}
	class FakeCanvas extends EventTarget {
		readonly style: Record<string, string> = {};
		readonly clientHeight = 600;
		readonly clientWidth = 800;
		ownerDocument: FakeDocument = new FakeDocument();
		readonly remove = () => undefined;
		getRootNode() {
			return this.ownerDocument;
		}
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 800, height: 600 };
		}
		setPointerCapture() {}
		releasePointerCapture() {}
	}
	const renderers: { domElement: FakeCanvas; render: ReturnType<typeof vi.fn> }[] = [];
	return { FakeCanvas, FakeDocument, renderers };
});

vi.mock("three", async (importOriginal) => {
	const actual = await importOriginal<typeof import("three")>();
	class FakeWebGLRenderer {
		readonly domElement = new fakes.FakeCanvas();
		readonly info = { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } };
		readonly render = vi.fn();
		constructor() {
			fakes.renderers.push(this);
		}
		getContext() {
			return {};
		}
		setPixelRatio() {}
		setSize() {}
		setClearColor() {}
		dispose() {}
	}
	return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

type FrameCallback = (time: number) => void;

let frames = new Map<number, FrameCallback>();
let nextFrameId = 0;
let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
	disconnected = false;
	constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
		observers.push(this);
	}
	observe() {}
	disconnect() {
		this.disconnected = true;
	}
}

const requestAnimationFrame = vi.fn((callback: FrameCallback) => {
	nextFrameId += 1;
	frames.set(nextFrameId, callback);
	return nextFrameId;
});
const cancelAnimationFrame = vi.fn((id: number) => {
	frames.delete(id);
});

function runFrame(time: number) {
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback(time);
}

function setup(mode: "2d" | "3d" = "3d") {
	const container = { clientHeight: 600, clientWidth: 800, append: () => undefined } as unknown as HTMLElement;
	const graph = new Graphraum(container, { mode });
	graph.setData({
		nodes: [
			{ id: "a", position: { x: -50, y: 0, z: 0 } },
			{ id: "b", position: { x: 50, y: 0, z: 0 } },
		],
		edges: [{ id: "ab", source: "a", target: "b" }],
	});
	runFrame(0);
	const renderer = fakes.renderers.at(-1);
	if (!renderer) throw new Error("renderer was not created");
	return { graph, renderer, canvas: renderer.domElement, document: renderer.domElement.ownerDocument };
}

interface ControlsHandle {
	autoRotate: boolean;
	autoRotateSpeed: number;
	dispatchEvent(event: { type: "end" | "start" }): void;
	update(deltaSeconds?: number): boolean;
}

function controlsOf(graph: Graphraum) {
	return Reflect.get(graph, "controls") as ControlsHandle;
}

function wheelEvent() {
	return Object.assign(new Event("wheel"), { clientX: 0, clientY: 0, ctrlKey: false, deltaMode: 0, deltaY: 100 });
}

function cameraAzimuth(graph: Graphraum) {
	const camera = Reflect.get(graph, "camera") as { position: Vector3 };
	return new Spherical().setFromVector3(new Vector3().copy(camera.position)).theta;
}

beforeEach(() => {
	frames = new Map();
	nextFrameId = 0;
	observers = [];
	fakes.renderers.length = 0;
	requestAnimationFrame.mockClear();
	cancelAnimationFrame.mockClear();
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	vi.stubGlobal("window", { devicePixelRatio: 1 });
	vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
	vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			disconnect() {}
		},
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("Graphraum auto-orbit", () => {
	test("is off by default and schedules no frames while disabled", () => {
		const { graph } = setup();
		expect(graph.getDiagnostics().autoOrbit).toBe("off");
		expect(frames.size).toBe(0);
		requestAnimationFrame.mockClear();

		graph.setAutoOrbit(false);
		graph.setAutoOrbit(false);
		expect(requestAnimationFrame).not.toHaveBeenCalled();
		expect(graph.getDiagnostics().autoOrbit).toBe("off");

		graph.setAutoOrbit({});
		graph.setAutoOrbit(false);
		expect(frames.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	test("throws an actionable error in 2D and for invalid options", () => {
		const { graph } = setup("2d");
		expect(() => graph.setAutoOrbit({})).toThrow(/3D mode.*setMode\("3d"\)/);
		graph.setMode("3d");
		expect(() => graph.setAutoOrbit({ speed: 3 })).toThrow(/speed/);
		expect(graph.getDiagnostics().autoOrbit).toBe("off");
	});

	test("orbits at speed radians per second with clamped steps and one render per frame", () => {
		const { graph, renderer } = setup();
		graph.setAutoOrbit({ speed: 1 });
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
		const start = cameraAzimuth(graph);
		renderer.render.mockClear();

		runFrame(1000);
		runFrame(1050);
		expect(Math.abs(cameraAzimuth(graph) - start)).toBeCloseTo(0.05);

		runFrame(60_000);
		expect(Math.abs(cameraAzimuth(graph) - start)).toBeCloseTo(0.15);
		expect(renderer.render).toHaveBeenCalledTimes(2);
		expect(frames.size).toBe(1);
	});

	test("pauses on wheel input and resumes after the idle delay", () => {
		const { graph, canvas } = setup();
		graph.setAutoOrbit({ resumeAfterMs: 500 });

		canvas.dispatchEvent(wheelEvent());
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		expect(frames.size).toBe(1); // the zoom's own render request, not an orbit frame
		runFrame(16);
		expect(frames.size).toBe(0);
		vi.advanceTimersByTime(499);
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		vi.advanceTimersByTime(1);
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
		expect(frames.size).toBe(1);
	});

	test("a drag pauses from controls start until controls end, then waits for idle", () => {
		const { graph } = setup();
		graph.setAutoOrbit({ resumeAfterMs: 500 });
		const controls = controlsOf(graph);

		controls.dispatchEvent({ type: "start" });
		vi.advanceTimersByTime(5000);
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		expect(frames.size).toBe(0);
		controls.dispatchEvent({ type: "end" });
		vi.advanceTimersByTime(499);
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		controls.dispatchEvent({ type: "start" });
		vi.advanceTimersByTime(1000);
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		controls.dispatchEvent({ type: "end" });
		vi.advanceTimersByTime(500);
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
	});

	test("orbit frames do not rematerialize the viewport, but user view changes do", () => {
		const materialize = vi.spyOn(
			Graphraum.prototype as unknown as { materializeViewport: () => void },
			"materializeViewport",
		);
		const listener = vi.fn();
		const { graph, canvas, renderer } = setup();
		graph.onViewChange(listener);
		graph.setAutoOrbit({ speed: 1 });
		runFrame(1000);
		materialize.mockClear();
		renderer.render.mockClear();
		listener.mockClear();

		for (let frame = 1; frame <= 10; frame += 1) runFrame(1000 + frame * 16);
		expect(renderer.render).toHaveBeenCalledTimes(10);
		expect(listener).toHaveBeenCalledTimes(10);
		expect(materialize).not.toHaveBeenCalled();

		canvas.dispatchEvent(wheelEvent());
		expect(materialize).toHaveBeenCalledTimes(1);
		materialize.mockRestore();
	});

	test("autoRotate is only on during the orbit step, so a plain update adds no rotation", () => {
		const { graph } = setup();
		graph.setAutoOrbit({ speed: 1 });
		runFrame(1000);
		runFrame(1050);
		const controls = controlsOf(graph);
		expect(controls.autoRotate).toBe(false);
		const azimuth = cameraAzimuth(graph);
		controls.update();
		expect(cameraAzimuth(graph)).toBeCloseTo(azimuth, 10);
	});

	test("setAutoOrbit again updates speed and resume delay", () => {
		const { graph, canvas } = setup();
		graph.setAutoOrbit({ speed: 1, resumeAfterMs: 500 });
		graph.setAutoOrbit({ speed: 2, resumeAfterMs: 100 });
		expect(controlsOf(graph).autoRotateSpeed).toBeCloseTo(120 / (2 * Math.PI));
		const start = cameraAzimuth(graph);
		runFrame(1000);
		runFrame(1050);
		expect(Math.abs(cameraAzimuth(graph) - start)).toBeCloseTo(0.1);

		canvas.dispatchEvent(wheelEvent());
		vi.advanceTimersByTime(100);
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
	});

	test("fitView and setData during an orbit keep it running", () => {
		const { graph } = setup();
		graph.setAutoOrbit({});
		graph.fitView();
		graph.setData({ nodes: [{ id: "c", position: { x: 0, y: 0, z: 10 } }], edges: [] });
		runFrame(1000);
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
		expect(frames.size).toBe(1);
	});

	test("a throwing orbit step stops the orbit instead of leaving it active without a loop", () => {
		const { graph } = setup();
		graph.setAutoOrbit({});
		const controls = controlsOf(graph);
		vi.spyOn(controls, "update").mockImplementation(() => {
			throw new Error("boom");
		});
		expect(() => runFrame(1000)).toThrow("boom");
		expect(controls.autoRotate).toBe(false);
		expect(graph.getDiagnostics().autoOrbit).toBe("off");
		expect(frames.size).toBe(0);
	});

	test("setAutoOrbit after destroy does nothing", () => {
		const { graph } = setup();
		graph.destroy();
		requestAnimationFrame.mockClear();
		expect(() => graph.setAutoOrbit({})).not.toThrow();
		expect(requestAnimationFrame).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	test("stops while the document is hidden or the canvas is off screen", () => {
		vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
		const { graph, document } = setup();
		graph.setAutoOrbit({});

		document.hidden = true;
		document.dispatchEvent(new Event("visibilitychange"));
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		expect(frames.size).toBe(0);
		document.hidden = false;
		document.dispatchEvent(new Event("visibilitychange"));
		expect(graph.getDiagnostics().autoOrbit).toBe("active");

		const observer = observers.at(-1);
		observer?.callback([{ isIntersecting: false }]);
		expect(graph.getDiagnostics().autoOrbit).toBe("paused");
		expect(frames.size).toBe(0);
		observer?.callback([{ isIntersecting: true }]);
		expect(graph.getDiagnostics().autoOrbit).toBe("active");
		expect(frames.size).toBe(1);
	});

	test("switching to 2D turns the orbit off", () => {
		const { graph } = setup();
		graph.setAutoOrbit({});
		graph.setMode("2d");
		runFrame(16);
		expect(graph.getDiagnostics().autoOrbit).toBe("off");
		expect(frames.size).toBe(0);
	});

	test("destroy cancels the frame, the timer, the listeners and the observer", () => {
		vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
		const { graph, canvas, document } = setup();
		graph.setAutoOrbit({});
		canvas.dispatchEvent(wheelEvent());
		expect(vi.getTimerCount()).toBe(1);

		graph.destroy();
		expect(vi.getTimerCount()).toBe(0);
		expect(frames.size).toBe(0);
		expect(observers.at(-1)?.disconnected).toBe(true);

		requestAnimationFrame.mockClear();
		document.dispatchEvent(new Event("visibilitychange"));
		vi.runAllTimers();
		expect(requestAnimationFrame).not.toHaveBeenCalled();
	});
});
