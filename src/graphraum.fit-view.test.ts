import { type OrthographicCamera, type PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("three", async (importOriginal) => {
	const actual = await importOriginal<typeof import("three")>();
	const { FakeWebGLRenderer } = await import("./test-support/fake-webgl");
	return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { Graphraum } from "./graphraum";
import { glowHaloRadius } from "./node-glow";
import { FakeElement, installFakeBrowserGlobals } from "./test-support/fake-webgl";
import type { GraphraumData } from "./types";

beforeAll(() => installFakeBrowserGlobals((name, value) => vi.stubGlobal(name, value)));

const graphs: Graphraum[] = [];
afterEach(() => {
	for (const graph of graphs.splice(0)) graph.destroy();
});

function createGraph(width: number, height: number, mode: "2d" | "3d") {
	const graph = new Graphraum(new FakeElement(width, height) as unknown as HTMLElement, { mode });
	graphs.push(graph);
	return graph;
}

function cameraOf(graph: Graphraum) {
	return Reflect.get(graph, "camera") as OrthographicCamera | PerspectiveCamera;
}

/** A flat sheet three times wider than tall, like a clustered layout on a wide canvas. */
function wideSheet(): GraphraumData {
	const nodes = Array.from({ length: 61 * 21 }, (_, index) => ({
		id: `n${index}`,
		position: { x: (index % 61) * 10 - 300, y: Math.floor(index / 61) * 10 - 100, z: 0 },
		size: 4,
	}));
	return { nodes, edges: [] };
}

/** Largest NDC extent of any node or glow halo billboard on each axis. */
function projectedExtent(camera: PerspectiveCamera, data: GraphraumData) {
	camera.updateMatrixWorld();
	const point = new Vector3();
	let x = 0;
	let y = 0;
	let nearest = Number.POSITIVE_INFINITY;
	let farthest = 0;
	for (const node of data.nodes) {
		const size = node.size ?? 4;
		const radius = (node.glow ?? 0) > 0 ? glowHaloRadius(size, node.glow ?? 0) : size;
		point.set(node.position.x, node.position.y, node.position.z ?? 0).applyMatrix4(camera.matrixWorldInverse);
		const depth = -point.z;
		nearest = Math.min(nearest, depth);
		farthest = Math.max(farthest, depth);
		const tan = Math.tan((camera.fov * Math.PI) / 360);
		x = Math.max(x, (Math.abs(point.x) + radius) / (depth * tan * camera.aspect));
		y = Math.max(y, (Math.abs(point.y) + radius) / (depth * tan));
	}
	return { farthest, nearest, x, y };
}

describe("fitView", () => {
	test("3D fills a wide canvas without clipping any node", () => {
		const graph = createGraph(1792, 1150, "3d");
		const data = wideSheet();
		graph.setData(data);
		const camera = cameraOf(graph) as PerspectiveCamera;
		const extent = projectedExtent(camera, data);
		expect(Math.max(extent.x, extent.y)).toBeLessThanOrEqual(0.92 + 1e-9);
		expect(Math.max(extent.x, extent.y)).toBeGreaterThan(0.92 - 1e-6);
		expect(extent.nearest).toBeGreaterThan(camera.near);
		expect(extent.farthest).toBeLessThan(camera.far);
	});

	test("3D keeps the glow halo of an edge node on the canvas", () => {
		const graph = createGraph(1792, 1150, "3d");
		const sheet = wideSheet();
		const data = { ...sheet, nodes: sheet.nodes.map((node, index) => (index === 0 ? { ...node, glow: 1 } : node)) };
		graph.setData(data);
		const camera = cameraOf(graph) as PerspectiveCamera;
		const glowing = data.nodes.slice(0, 1);
		const halo = projectedExtent(camera, { nodes: glowing, edges: [] });
		const core = projectedExtent(camera, { nodes: glowing.map(({ glow: _, ...node }) => node), edges: [] });
		const all = projectedExtent(camera, data);
		expect(Math.max(all.x, all.y)).toBeLessThanOrEqual(0.92 + 1e-9);
		expect(halo.x).toBeCloseTo(0.92, 6);
		expect(core.x).toBeLessThan(0.92 - 1e-3);
	});

	test("3D fits the height of a tall canvas without clipping the width", () => {
		const graph = createGraph(600, 1000, "3d");
		const data = wideSheet();
		graph.setData(data);
		const extent = projectedExtent(cameraOf(graph) as PerspectiveCamera, data);
		expect(extent.x).toBeCloseTo(0.92, 6);
		expect(extent.y).toBeLessThan(extent.x);
	});

	test("3D keeps the front view and orbits around the middle of the graph depth", () => {
		const graph = createGraph(800, 600, "3d");
		graph.setData({
			nodes: [
				{ id: "a", position: { x: 100, y: 50, z: -20 } },
				{ id: "b", position: { x: 300, y: 90, z: 40 } },
			],
			edges: [],
		});
		const camera = cameraOf(graph);
		const target = Reflect.get(Reflect.get(graph, "controls"), "target") as Vector3;
		expect(target.z).toBeCloseTo(10, 9);
		expect(target.x).toBeGreaterThan(100);
		expect(target.x).toBeLessThan(300);
		expect(camera.getWorldDirection(new Vector3()).z).toBeCloseTo(-1, 12);
		expect(camera.position.x).toBeCloseTo(target.x, 9);
		expect(camera.position.y).toBeCloseTo(target.y, 9);
	});

	test("3D fitView after setMode refits the same graph the same way", () => {
		const graph = createGraph(1792, 1150, "2d");
		const data = wideSheet();
		graph.setData(data);
		graph.setMode("3d");
		const fromMode = cameraOf(graph).position.clone();
		graph.fitView();
		expect(cameraOf(graph).position.toArray()).toEqual(fromMode.toArray());
		const extent = projectedExtent(cameraOf(graph) as PerspectiveCamera, data);
		expect(Math.max(extent.x, extent.y)).toBeCloseTo(0.92, 6);
	});

	test("2D framing is unchanged", () => {
		const graph = createGraph(1792, 1150, "2d");
		graph.setData(wideSheet());
		const camera = cameraOf(graph) as OrthographicCamera;
		expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
			-349.59999999999997, 349.59999999999997, 224.35267857142856, -224.35267857142856,
		]);
		expect(camera.position.x).toBeCloseTo(0, 9);
		expect(camera.position.y).toBeCloseTo(0, 9);
		expect(camera.position.z).toBeCloseTo(1000, 9);
	});
	test("2D fitView undoes a previous wheel zoom", () => {
		const graph = createGraph(1792, 1150, "2d");
		graph.setData(wideSheet());
		const camera = cameraOf(graph) as OrthographicCamera;
		const fitted = [camera.left, camera.right, camera.top, camera.bottom, camera.zoom];
		// OrbitControls zooms an orthographic camera by scaling `camera.zoom`.
		camera.zoom = 0.4;
		camera.position.x += 120;
		camera.updateProjectionMatrix();
		graph.fitView();
		expect([camera.left, camera.right, camera.top, camera.bottom, camera.zoom]).toEqual(fitted);
		expect(camera.position.x).toBeCloseTo(0, 9);
		const fittedProjection = camera.projectionMatrix.clone();
		camera.updateProjectionMatrix();
		expect(camera.projectionMatrix.equals(fittedProjection)).toBe(true);
	});
});
