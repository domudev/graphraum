import { describe, expect, test } from "vitest";
import {
	createPlaygroundFixture,
	createPlaygroundVisuals,
	defaultPlaygroundAppearance,
	playgroundClusterSpan,
	playgroundClusters,
	playgroundNodeShapes,
} from "./playground";

describe("playground helpers", () => {
	test("builds a deterministic typed fixture", () => {
		const fixture = createPlaygroundFixture(12);
		expect(fixture.nodes).toHaveLength(12);
		expect(fixture.edges).toHaveLength(36);
		expect(fixture.nodes[0]?.attributes.kind).toBe("concept");
		expect(fixture.nodes[1]?.attributes.kind).toBe("document");
		expect(fixture.nodes[2]?.attributes.kind).toBe("person");
	});

	test("groups the stress fixture into communities with a few bridges", () => {
		const nodeCount = 1_000;
		const fixture = createPlaygroundFixture(nodeCount);
		const span = playgroundClusterSpan(nodeCount);
		const clusterOf = (id: string) => Math.floor(Number(id.slice(5)) / span);
		const bridges = fixture.edges.filter((edge) => clusterOf(edge.source) !== clusterOf(edge.target));

		expect(fixture.edges).toHaveLength(nodeCount * 3);
		expect(fixture.edges.every((edge) => edge.source !== edge.target)).toBe(true);
		expect(bridges.length).toBeGreaterThan(0);
		expect(bridges.length / fixture.edges.length).toBeLessThan(0.1);
	});

	test("connects every node into one graph", () => {
		const nodeCount = 10_000;
		const fixture = createPlaygroundFixture(nodeCount);
		const parent = Array.from({ length: nodeCount }, (_, index) => index);
		const find = (index: number): number => {
			while (parent[index] !== index) index = parent[index] = parent[parent[index] as number] as number;
			return index;
		};
		for (const edge of fixture.edges) parent[find(Number(edge.source.slice(5)))] = find(Number(edge.target.slice(5)));

		expect(new Set(parent.map((_, index) => find(index))).size).toBe(1);
	});

	test("labels every node with its dense community index", () => {
		const clusters = playgroundClusters(1_000);
		const span = playgroundClusterSpan(1_000);

		expect(clusters).toHaveLength(1_000);
		expect(clusters[0]).toBe(0);
		expect(clusters[span]).toBe(1);
		expect(new Set(clusters).size).toBe(Math.max(...clusters) + 1);
	});

	test("builds the same fixture on every call", () => {
		expect(createPlaygroundFixture(500)).toEqual(createPlaygroundFixture(500));
	});

	test("rejects undersized fixtures", () => {
		expect(() => createPlaygroundFixture(1)).toThrow(/at least two nodes/);
	});

	test("maps appearance into node and edge visuals", () => {
		const appearance = defaultPlaygroundAppearance();
		appearance.nodeShapes.concept = "hexagon";
		appearance.nodeStrokeWidth = 1.5;
		appearance.edgeStyle = "dashed";
		appearance.edgePath = "quadratic";
		appearance.edgeMarker = "triangle";
		appearance.edgeMarkerEnd = "both";
		const visuals = createPlaygroundVisuals(appearance);
		const fixture = createPlaygroundFixture(3);
		const node = fixture.nodes[0];
		const edge = fixture.edges[0];
		if (!node || !edge) throw new Error("Expected fixture rows.");
		expect(visuals.node?.(node)?.visual).toMatchObject({
			shape: "hexagon",
			strokeWidth: 1.5,
		});
		expect(visuals.node?.(node)?.presentation).toEqual({
			actions: [{ id: "inspect", label: "Inspect" }],
			subtitle: "concept",
			title: "concept-0",
		});
		expect(visuals.edge?.(edge)?.visual).toMatchObject({
			style: "dashed",
			path: "quadratic",
			marker: "triangle",
			markerEnd: "both",
		});
	});

	test("exposes the full GPU shape catalog", () => {
		expect(playgroundNodeShapes).toEqual(["circle", "square", "diamond", "hexagon", "triangle", "pill", "rounded"]);
	});
});
