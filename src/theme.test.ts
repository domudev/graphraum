import { describe, expect, it } from "vitest";
import { graphraumTheme } from "./theme";

describe("graphraumTheme", () => {
	it("uses the canonical Ink Black, Turf Green, and Porcelain renderer palette", () => {
		expect(graphraumTheme).toEqual({
			background: "#040f0f",
			edge: "#226f54",
			node: "#226f54",
			selectedNode: "#fcfffc",
		});
	});

	it("is immutable so one renderer cannot change another renderer's defaults", () => {
		expect(Object.isFrozen(graphraumTheme)).toBe(true);
	});
});
