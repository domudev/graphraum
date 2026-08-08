import { describe, expect, it } from "vitest";
import { graphraumTheme } from "./theme";

describe("graphraumTheme", () => {
	it("uses the canonical Ink Black, Turf Green, and Porcelain renderer palette", () => {
		expect(graphraumTheme).toEqual({
			background: "#040f0f",
			dimmedNode: "#315a51",
			edge: "#226f54",
			edgeOpacity: 0.55,
			edgeWidth: 1.5,
			focusedNode: "#73c7a5",
			hoveredNode: "#e4a853",
			node: "#226f54",
			nodeStroke: "#fcfffc",
			selectedNode: "#fcfffc",
		});
	});

	it("is immutable so one renderer cannot change another renderer's defaults", () => {
		expect(Object.isFrozen(graphraumTheme)).toBe(true);
	});
});
