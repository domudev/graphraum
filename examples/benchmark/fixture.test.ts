import { describe, expect, test } from "vitest";

import { createFixture, type Encoding, type FixtureOptions } from "./fixture";

function options(encoding: Encoding): FixtureOptions {
	return {
		edgeDistribution: "linear",
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

	test("generates random edges without self loops", () => {
		const random = createFixture({
			...options("mapper"),
			edgeDistribution: "random",
			edgeMultiplier: 4,
			nodeCount: 11,
		});
		const linear = createFixture({
			...options("mapper"),
			edgeDistribution: "linear",
			edgeMultiplier: 4,
			nodeCount: 11,
		});

		expect(random.edges.length).toBe(linear.edges.length);
		expect(random.edges.every(({ source, target }) => source !== target)).toBe(true);
	});

	test("uses deterministic random edges", () => {
		const first = createFixture({
			...options("snapshot"),
			edgeDistribution: "random",
			nodeCount: 13,
			edgeMultiplier: 3,
			edgeColors: { mentions: "#111111", related: "#222222" },
			nodeColors: { concept: "#333333", document: "#444444", person: "#555555" },
			nodeShapes: { concept: "diamond", document: "square", person: "circle" },
			nodeSize: 3,
			scoreSize: 4,
		});
		const second = createFixture({
			...options("snapshot"),
			edgeDistribution: "random",
			nodeCount: 13,
			edgeMultiplier: 3,
			edgeColors: { mentions: "#111111", related: "#222222" },
			nodeColors: { concept: "#333333", document: "#444444", person: "#555555" },
			nodeShapes: { concept: "diamond", document: "square", person: "circle" },
			nodeSize: 3,
			scoreSize: 4,
		});

		expect(first).toEqual(second);
	});

	test("creates dense communities with sparse bridge edges", () => {
		const nodeCount = 1_000;
		const fixture = createFixture({
			...options("mapper"),
			edgeDistribution: "clustered",
			edgeMultiplier: 3,
			nodeCount,
		});
		const clusterCount = Math.max(2, Math.ceil(Math.sqrt(nodeCount / 100)));
		const clusterSize = Math.ceil(nodeCount / clusterCount);
		const bridges = fixture.edges.filter(
			(edge) =>
				Math.floor(Number(edge.source.slice(5)) / clusterSize) !==
				Math.floor(Number(edge.target.slice(5)) / clusterSize),
		);

		expect(new Set(fixture.nodes.map((node) => node.attributes.cluster))).toHaveLength(clusterCount);
		expect(bridges.length).toBeGreaterThan(0);
		expect(bridges.length).toBeLessThan(fixture.edges.length / 5);
	});
});
