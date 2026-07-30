import { describe, expect, test } from "vitest";

import { createFixture, type Encoding, type FixtureOptions } from "./fixture";

function options(encoding: Encoding): FixtureOptions {
	return {
		edgeColors: { mentions: "#111111", related: "#222222" },
		edgeMultiplier: 2,
		encoding,
		nodeColors: { concept: "#333333", document: "#444444", person: "#555555" },
		nodeCount: 11,
		nodeShapes: { concept: "diamond", document: "square", person: "circle" },
		nodeSize: 3,
		scoreSize: 4,
	};
}

describe("createFixture", () => {
	test("creates the requested node and edge counts", () => {
		const fixture = createFixture(options("mapper"));

		expect(fixture.nodes).toHaveLength(11);
		expect(fixture.edges).toHaveLength(22);
	});

	test("keeps mapper data semantic and snapshot data visual", () => {
		const mapper = createFixture(options("mapper"));
		const snapshot = createFixture(options("snapshot"));

		expect(mapper.nodes[1]).not.toHaveProperty("color");
		expect(mapper.edges[1]).not.toHaveProperty("color");
		expect(snapshot.nodes[1]).toMatchObject({ color: "#444444", shape: "square", size: 3.8 });
		expect(snapshot.edges[1]).toHaveProperty("color", "#222222");
		expect(snapshot.nodes[0]).not.toHaveProperty("color");
		expect(snapshot.edges[0]).not.toHaveProperty("color");
	});
});
