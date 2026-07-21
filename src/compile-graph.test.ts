import { describe, expect, test } from "vitest";

import { compileGraph } from "./compile-graph";

describe("compileGraph", () => {
	test("builds edge positions from node identities", () => {
		const graph = compileGraph({
			edges: [{ id: "a-b", source: "a", target: "b" }],
			nodes: [
				{ id: "a", position: { x: 1, y: 2 } },
				{ id: "b", position: { x: 3, y: 4, z: 5 } },
			],
		});

		expect([...graph.nodePositions]).toEqual([1, 2, 0, 3, 4, 5]);
		expect([...graph.edgePositions]).toEqual([1, 2, 0, 3, 4, 5]);
	});

	test("rejects duplicate node identities before rendering", () => {
		expect(() =>
			compileGraph({
				edges: [],
				nodes: [
					{ id: "same", position: { x: 0, y: 0 } },
					{ id: "same", position: { x: 1, y: 1 } },
				],
			}),
		).toThrow('Duplicate node id: "same"');
	});

	test("rejects edges whose endpoints are absent", () => {
		expect(() =>
			compileGraph({
				edges: [{ id: "broken", source: "present", target: "missing" }],
				nodes: [{ id: "present", position: { x: 0, y: 0 } }],
			}),
		).toThrow('Edge "broken" references missing target "missing"');
	});
});
