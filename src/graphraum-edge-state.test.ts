import type { InstancedBufferAttribute, InstancedMesh } from "three";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("three", async (importOriginal) => {
	const actual = await importOriginal<typeof import("three")>();
	const { FakeWebGLRenderer } = await import("./test-support/fake-webgl");
	return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import type { VisibleEdgeLayout } from "./edge-viewport-patch";
import { Graphraum } from "./graphraum";
import { FakeElement, installFakeBrowserGlobals } from "./test-support/fake-webgl";
import type { GraphraumData, GraphraumEdge, GraphraumMode, GraphraumOptions } from "./types";

interface GraphraumInternals {
	edgeMesh: InstancedMesh | null;
	materializeViewport(): void;
	visibleEdgeLayouts: Map<number, VisibleEdgeLayout>;
}

const EDGE_ATTRIBUTES = [
	"instanceKind",
	"instanceEndA",
	"instanceEndB",
	"instanceColor",
	"instanceWidth",
	"instanceStyle",
] as const;

const graphs: Graphraum[] = [];

beforeAll(() => installFakeBrowserGlobals((name, value) => vi.stubGlobal(name, value)));
afterEach(() => {
	for (const graph of graphs.splice(0)) graph.destroy();
	vi.restoreAllMocks();
});

function internals(graph: Graphraum): GraphraumInternals {
	return graph as unknown as GraphraumInternals;
}

function createGraph(options: GraphraumOptions = {}) {
	const graph = new Graphraum(new FakeElement() as unknown as HTMLElement, options);
	graphs.push(graph);
	return graph;
}

function seededRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 2 ** 32;
	};
}

/** Mixed fixture: curves, markers, domain colors and opacities so every pack branch is exercised. */
function mixedFixture(nodeCount: number, edgeCount: number, seed: number): GraphraumData {
	const random = seededRandom(seed);
	const nodes = Array.from({ length: nodeCount }, (_, index) => ({
		id: `n${index}`,
		position: { x: random() * 400 - 200, y: random() * 400 - 200, z: random() * 40 - 20 },
	}));
	const paths = ["straight", "quadratic", "cubic"] as const;
	const edges = Array.from({ length: edgeCount }, (_, index): GraphraumEdge => {
		const source = Math.floor(random() * nodeCount);
		const target = (source + 1 + Math.floor(random() * (nodeCount - 1))) % nodeCount;
		return {
			id: `e${index}`,
			source: `n${source}`,
			target: `n${target}`,
			...(index % 3 === 0 ? { color: "#6d5bd0" } : {}),
			...(index % 4 === 0 ? { opacity: 0.3 } : {}),
			...(index % 5 === 0 ? { marker: "triangle" as const, markerEnd: "both" as const } : {}),
			path: paths[index % paths.length],
		};
	});
	return { nodes, edges };
}

function edgeBuffers(graph: Graphraum) {
	const mesh = internals(graph).edgeMesh;
	if (!mesh) throw new Error("edge mesh missing");
	return Object.fromEntries(
		EDGE_ATTRIBUTES.map((name) => {
			const attribute = mesh.geometry.getAttribute(name);
			return [name, Array.from(attribute.array.slice(0, mesh.count * attribute.itemSize))];
		}),
	);
}

/** Instance data grouped by edge index so slot order does not matter. */
function edgeInstancesByEdge(graph: Graphraum) {
	const mesh = internals(graph).edgeMesh;
	if (!mesh) throw new Error("edge mesh missing");
	const byEdge = [...internals(graph).visibleEdgeLayouts.entries()].sort(([left], [right]) => left - right);
	return byEdge.map(([edgeIndex, layout]) => {
		const slots = [
			...Array.from({ length: layout.segmentCount }, (_, offset) => layout.segmentStart + offset),
			...Array.from({ length: layout.markerCount }, (_, offset) => layout.markerStart + offset),
		];
		return {
			edgeIndex,
			instances: slots.map((slot) =>
				EDGE_ATTRIBUTES.flatMap((name) => {
					const attribute = mesh.geometry.getAttribute(name);
					return Array.from(attribute.array.slice(slot * attribute.itemSize, (slot + 1) * attribute.itemSize));
				}),
			),
		};
	});
}

function edgeColorSlots(graph: Graphraum, edgeIndex: number): number[][] {
	const mesh = internals(graph).edgeMesh;
	const layout = internals(graph).visibleEdgeLayouts.get(edgeIndex);
	if (!mesh || !layout) throw new Error(`edge ${edgeIndex} is not visible`);
	const color = mesh.geometry.getAttribute("instanceColor");
	const slots = [
		...Array.from({ length: layout.segmentCount }, (_, offset) => layout.segmentStart + offset),
		...Array.from({ length: layout.markerCount }, (_, offset) => layout.markerStart + offset),
	];
	return slots.map((slot) => [color.getX(slot), color.getY(slot), color.getZ(slot), color.getW(slot)]);
}

function pickSubset(random: () => number, ids: readonly string[], probability: number) {
	return ids.filter(() => random() < probability);
}

describe("incremental edge selection", () => {
	test("setEdgeSelection patches instance colors without a full viewport materialize", () => {
		const graph = createGraph();
		graph.setData(mixedFixture(30, 60, 1));
		const materialize = vi.spyOn(internals(graph), "materializeViewport");
		const colorAttribute = internals(graph).edgeMesh?.geometry.getAttribute("instanceColor") as
			| InstancedBufferAttribute
			| undefined;
		colorAttribute?.clearUpdateRanges();

		graph.setEdgeSelection(["e0", "e1"]);

		expect(materialize).not.toHaveBeenCalled();
		const layouts = internals(graph).visibleEdgeLayouts;
		const expectedSlots = [0, 1].reduce((count, edgeIndex) => {
			const layout = layouts.get(edgeIndex);
			return count + (layout ? layout.segmentCount + layout.markerCount : 0);
		}, 0);
		const uploadedFloats = (colorAttribute?.updateRanges ?? []).reduce((sum, range) => sum + range.count, 0);
		expect(uploadedFloats).toBe(expectedSlots * 4);
	});

	/**
	 * Node moves can reorder slots on a later full materialize (spatial-grid order), so runs with
	 * moves compare per-edge instance data; runs without moves compare the raw buffers byte for byte.
	 */
	test.each([
		["2d", {}, false],
		["3d", {}, false],
		["2d", { maxVisibleEdges: 48 }, false],
		["2d", {}, true],
		["3d", {}, true],
	] as const satisfies readonly (readonly [GraphraumMode, GraphraumOptions, boolean])[])(
		"incremental updates match a full materialize (%s, %o, moves=%s)",
		(mode, options, moves) => {
			const random = seededRandom(mode === "2d" ? 7 : 11);
			const graph = createGraph({ ...options, mode });
			const data = mixedFixture(40, 120, 3);
			graph.setData(data);
			const ids = [...data.edges.map((edge) => edge.id), "ghost-a", "ghost-b"];
			const snapshot = moves ? edgeInstancesByEdge : edgeBuffers;
			const materialize = vi.spyOn(internals(graph), "materializeViewport");

			for (let step = 0; step < 120; step += 1) {
				const roll = random();
				if (roll < 0.1) {
					graph.setEdgeSelection([]);
				} else if (moves && roll < 0.25) {
					const node = data.nodes[Math.floor(random() * data.nodes.length)];
					if (node) {
						graph.updateNodes([
							{ id: node.id, position: { x: node.position.x + random() * 4, y: node.position.y, z: 0 } },
						]);
					}
				} else {
					graph.setEdgeSelection(pickSubset(random, ids, 0.1));
				}
				if (step % 10 === 9) {
					if (!moves) expect(materialize).not.toHaveBeenCalled();
					const incremental = snapshot(graph);
					graph.setTheme({});
					expect(snapshot(graph)).toEqual(incremental);
					materialize.mockClear();
				}
			}
		},
	);

	test("ignores unknown edge ids", () => {
		const graph = createGraph();
		graph.setData(mixedFixture(10, 12, 5));
		graph.setEdgeSelection(["e1", "missing"]);
		expect(graph.getDiagnostics().selectedEdges).toBe(1);
	});

	test("clearing the selection restores base edge visuals", () => {
		const graph = createGraph();
		graph.setData(mixedFixture(10, 12, 5));
		const before = edgeBuffers(graph);
		graph.setEdgeSelection(["e0", "e3"]);
		expect(edgeBuffers(graph)).not.toEqual(before);
		graph.setEdgeSelection([]);
		expect(edgeBuffers(graph)).toEqual(before);
	});

	test("theme changes re-apply the selected edge color", () => {
		const graph = createGraph();
		graph.setData(mixedFixture(10, 12, 5));
		graph.setEdgeSelection(["e1"]);
		graph.setTheme({ selectedEdge: "#ff0000" });
		for (const [red, green, blue] of edgeColorSlots(graph, 1)) {
			expect([red, green, blue]).toEqual([1, 0, 0]);
		}
	});

	test("topology changes prune selected edges that no longer exist", () => {
		const graph = createGraph();
		graph.setData(mixedFixture(10, 12, 5));
		graph.setEdgeSelection(["e1", "e2"]);
		graph.applyDataPatch({ removedEdgeIds: ["e1"] });
		expect(graph.getDiagnostics().selectedEdges).toBe(1);
		graph.setData(mixedFixture(10, 2, 5));
		expect(graph.getDiagnostics().selectedEdges).toBe(0);
	});
});
