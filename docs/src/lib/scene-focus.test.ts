import { describe, expect, test } from "vitest";

import { incidentEdgeIds, outsideNeighborhood } from "./scene-focus";

const data = {
	nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }].map((node) => ({ ...node, position: { x: 0, y: 0 } })),
	edges: [
		{ id: "ab", source: "a", target: "b" },
		{ id: "ca", source: "c", target: "a" },
		{ id: "cd", source: "c", target: "d" },
	],
};

describe("scene focus", () => {
	test("finds edges in either direction", () => {
		expect(incidentEdgeIds(data, "a")).toEqual(["ab", "ca"]);
	});

	test("dims only what is outside the one-hop neighborhood", () => {
		expect(outsideNeighborhood(data, "a")).toEqual({ edgeIds: ["cd"], nodeIds: ["d"] });
	});
});
