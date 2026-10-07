import { InstancedMesh, type Object3D, type Scene } from "three";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Graphraum } from "./graphraum";
import type { GraphraumData, GraphraumMode } from "./types";

interface FakeRenderer {
	readonly info: { render: { calls: number } };
	scene: Scene | null;
}

const fakes = vi.hoisted(() => ({ renderer: null as FakeRenderer | null }));

vi.mock("three", async (importOriginal) => {
	const three = await importOriginal<typeof import("three")>();
	/**
	 * Headless WebGL stand-in. `render` counts one draw call per visible instanced mesh with at
	 * least one instance, matching Three.js (`renderInstances` skips `primcount === 0`).
	 */
	class HeadlessRenderer implements FakeRenderer {
		readonly domElement = {
			addEventListener: () => {},
			clientHeight: 600,
			clientWidth: 800,
			getBoundingClientRect: () => ({ height: 600, left: 0, top: 0, width: 800 }),
			remove: () => {},
			removeEventListener: () => {},
			style: {},
		};
		readonly info = { memory: { geometries: 0, textures: 0 }, render: { calls: 0 } };
		scene: Scene | null = null;

		constructor() {
			fakes.renderer = this;
		}

		dispose() {}
		getContext() {
			return {};
		}
		render(scene: Scene) {
			this.scene = scene;
			let calls = 0;
			scene.traverseVisible((object: Object3D) => {
				if (object instanceof three.InstancedMesh && object.count > 0) calls += 1;
			});
			this.info.render.calls = calls;
		}
		setClearColor() {}
		setPixelRatio() {}
		setSize() {}
	}
	return { ...three, WebGLRenderer: HeadlessRenderer };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", async () => {
	const { Vector3 } = await import("three");
	class HeadlessControls {
		readonly mouseButtons: Record<string, number> = {};
		readonly target = new Vector3();
		enableDamping = true;
		enableRotate = true;
		minZoom = 0;
		screenSpacePanning = false;
		addEventListener() {}
		dispose() {}
		removeEventListener() {}
		update() {}
	}
	return { OrbitControls: HeadlessControls };
});

let frames: FrameRequestCallback[] = [];

function flushFrames() {
	const pending = frames;
	frames = [];
	for (const frame of pending) frame(0);
}

function renderer(): FakeRenderer {
	const current = fakes.renderer;
	if (!current) throw new Error("renderer not constructed");
	return current;
}

function glowMesh(): InstancedMesh | undefined {
	const scene = renderer().scene;
	return scene?.children.find(
		(child): child is InstancedMesh => child instanceof InstancedMesh && child.name === "graphraum-node-glow",
	);
}

function createGraph(mode: GraphraumMode = "2d") {
	const container = { append: () => {}, clientHeight: 600, clientWidth: 800 } as unknown as HTMLElement;
	return new Graphraum(container, { mode });
}

function graphData(glow: readonly (number | undefined)[]): GraphraumData {
	return {
		edges: glow.length > 1 ? [{ id: "e", source: "n0", target: "n1" }] : [],
		nodes: glow.map((value, index) => ({
			id: `n${index}`,
			position: { x: index * 10, y: 0 },
			...(value === undefined ? {} : { glow: value }),
		})),
	};
}

beforeEach(() => {
	frames = [];
	vi.stubGlobal("window", { devicePixelRatio: 1 });
	vi.stubGlobal(
		"ResizeObserver",
		class {
			disconnect() {}
			observe() {}
		},
	);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
	vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	fakes.renderer = null;
});

describe("Graphraum node glow", () => {
	test.each(["2d", "3d"] as const)("keeps two draw calls without glow in %s", (mode) => {
		const graph = createGraph(mode);
		graph.setData(graphData([undefined, 0, undefined]));
		flushFrames();
		const diagnostics = graph.getDiagnostics();
		expect(diagnostics.gpuDrawCalls).toBe(2);
		expect(diagnostics.visibleGlowNodes).toBe(0);
		expect(glowMesh()).toBeUndefined();
		graph.destroy();
	});

	test.each(["2d", "3d"] as const)("adds exactly one draw call for glowing nodes in %s", (mode) => {
		const graph = createGraph(mode);
		graph.setData(graphData([1, 0.5, 0]));
		flushFrames();
		const diagnostics = graph.getDiagnostics();
		expect(diagnostics.gpuDrawCalls).toBe(3);
		expect(diagnostics.visibleGlowNodes).toBe(2);
		graph.destroy();
	});

	test("renders halos behind edges and nodes without writing depth", () => {
		const graph = createGraph();
		graph.setData(graphData([1, 0]));
		flushFrames();
		const mesh = glowMesh();
		expect(mesh).toBeDefined();
		const others = renderer().scene?.children.filter((child) => child instanceof InstancedMesh && child !== mesh);
		for (const other of others ?? []) expect(mesh?.renderOrder).toBeLessThan(other.renderOrder);
		expect(mesh?.material).toMatchObject({ depthTest: false, depthWrite: false, transparent: true });
		graph.destroy();
	});

	test("updateNodes toggles glow on and off", () => {
		const graph = createGraph();
		graph.setData(graphData([undefined, undefined]));
		flushFrames();
		expect(graph.getDiagnostics().gpuDrawCalls).toBe(2);

		graph.updateNodes([{ id: "n1", glow: 0.8 }]);
		flushFrames();
		expect(graph.getDiagnostics()).toMatchObject({ gpuDrawCalls: 3, visibleGlowNodes: 1 });

		graph.updateNodes([{ id: "n1", glow: 0 }]);
		flushFrames();
		expect(graph.getDiagnostics()).toMatchObject({ gpuDrawCalls: 2, visibleGlowNodes: 0 });
		graph.destroy();
	});

	test("moves halos with node position updates and scales them by glow", () => {
		const graph = createGraph();
		graph.setData(graphData([1]));
		flushFrames();
		graph.updateNodes([{ id: "n0", position: { x: 5, y: 7 } }]);
		const elements = glowMesh()?.instanceMatrix.array;
		// Default node half-extent is 4 world units, so glow 1 yields a radius of 4 × 3.4.
		expect(elements?.[0]).toBeCloseTo(13.6);
		expect([elements?.[12], elements?.[13]]).toEqual([5, 7]);
		graph.destroy();
	});

	test("applyDataPatch adds glowing nodes to the halo pass", () => {
		const graph = createGraph();
		graph.setData(graphData([undefined, undefined]));
		flushFrames();
		graph.applyDataPatch({ addedNodes: [{ glow: 0.3, id: "n2", position: { x: 20, y: 0 } }] });
		flushFrames();
		expect(graph.getDiagnostics()).toMatchObject({ gpuDrawCalls: 3, visibleGlowNodes: 1 });
		graph.applyDataPatch({ removedNodeIds: ["n2"] });
		flushFrames();
		expect(graph.getDiagnostics()).toMatchObject({ gpuDrawCalls: 2, visibleGlowNodes: 0 });
		graph.destroy();
	});

	test("keeps halo color in sync with node state colors", () => {
		const graph = createGraph();
		graph.setData(graphData([1]));
		flushFrames();
		const mesh = glowMesh();
		const before = [...(mesh?.instanceColor?.array.slice(0, 3) ?? [])];
		graph.setSelection(["n0"]);
		flushFrames();
		const after = [...(mesh?.instanceColor?.array.slice(0, 3) ?? [])];
		expect(after).not.toEqual(before);
		graph.destroy();
	});

	test("disposes the glow mesh on topology rebuild and destroy", () => {
		const graph = createGraph();
		graph.setData(graphData([1]));
		flushFrames();
		const first = glowMesh();
		if (!first) throw new Error("expected a glow mesh");
		const firstGeometry = vi.spyOn(first.geometry, "dispose");
		graph.setData(graphData([undefined]));
		flushFrames();
		expect(firstGeometry).toHaveBeenCalledOnce();
		expect(glowMesh()).toBeUndefined();

		graph.setData(graphData([0.4]));
		flushFrames();
		const second = glowMesh();
		if (!second) throw new Error("expected a glow mesh");
		const geometry = vi.spyOn(second.geometry, "dispose");
		const material = vi.spyOn(second.material as { dispose: () => void }, "dispose");
		const scene = renderer().scene;
		graph.destroy();
		expect(geometry).toHaveBeenCalledOnce();
		expect(material).toHaveBeenCalledOnce();
		expect(scene?.children.includes(second)).toBe(false);
	});
});
