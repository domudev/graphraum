import { describe, expect, test } from "vitest";
import {
	createPlaygroundFixture,
	createPlaygroundVisuals,
	defaultPlaygroundAppearance,
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

	test("rejects undersized fixtures", () => {
		expect(() => createPlaygroundFixture(1)).toThrow(/at least two nodes/);
	});

	test("maps appearance into node and edge visuals", () => {
		const appearance = defaultPlaygroundAppearance();
		appearance.nodeShapes.concept = "hexagon";
		appearance.nodeStrokeWidth = 1.5;
		appearance.edgeStyle = "dashed";
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
		expect(visuals.edge?.(edge)?.visual).toMatchObject({
			style: "dashed",
			marker: "triangle",
			markerEnd: "both",
		});
	});

	test("exposes the full GPU shape catalog", () => {
		expect(playgroundNodeShapes).toEqual(["circle", "square", "diamond", "hexagon", "triangle", "pill", "rounded"]);
	});
});
