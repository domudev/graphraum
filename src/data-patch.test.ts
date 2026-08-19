import { describe, expect, test } from "vitest";

import { dataPatchFitsCapacity, isAppendOnlyDataPatch, mergeDataPatch } from "./data-patch";

describe("mergeDataPatch", () => {
	test("removes nodes and cascades edges that lost an endpoint", () => {
		const merged = mergeDataPatch(
			[
				{ id: "a", position: { x: 0, y: 0 } },
				{ id: "b", position: { x: 1, y: 0 } },
				{ id: "c", position: { x: 2, y: 0 } },
			],
			[
				{ id: "ab", source: "a", target: "b" },
				{ id: "bc", source: "b", target: "c" },
			],
			{ removedNodeIds: ["b"] },
		);
		expect(merged.nodes.map((node) => node.id)).toEqual(["a", "c"]);
		expect(merged.edges).toEqual([]);
	});

	test("adds nodes and edges after removals", () => {
		const merged = mergeDataPatch(
			[
				{ id: "a", position: { x: 0, y: 0 } },
				{ id: "b", position: { x: 1, y: 0 } },
			],
			[{ id: "ab", source: "a", target: "b" }],
			{
				addedEdges: [{ id: "ad", source: "a", target: "d" }],
				addedNodes: [{ id: "d", position: { x: 3, y: 0 } }],
				removedEdgeIds: ["ab"],
				removedNodeIds: ["b"],
			},
		);
		expect(merged.nodes.map((node) => node.id)).toEqual(["a", "d"]);
		expect(merged.edges.map((edge) => edge.id)).toEqual(["ad"]);
	});
});

describe("dataPatchFitsCapacity", () => {
	test("accepts merges within capacity and rejects growth past capacity", () => {
		expect(dataPatchFitsCapacity({ nodes: [1, 2], edges: [1] }, { nodes: 4, edges: 4 })).toBe(true);
		expect(dataPatchFitsCapacity({ nodes: [1, 2, 3], edges: [] }, { nodes: 2, edges: 4 })).toBe(false);
	});
});

describe("isAppendOnlyDataPatch", () => {
	test("detects remove fields", () => {
		expect(isAppendOnlyDataPatch({ addedNodes: [{ id: "n", position: { x: 0, y: 0 } }] })).toBe(true);
		expect(isAppendOnlyDataPatch({ removedNodeIds: ["a"] })).toBe(false);
		expect(isAppendOnlyDataPatch({ removedEdgeIds: ["e"] })).toBe(false);
	});
});
