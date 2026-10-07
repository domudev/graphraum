import { describe, expect, test } from "vitest";

import { changedIds, type EdgeStateStyling, resolveEdgePaint } from "./edge-state";

const defaults = { color: "#226f54", opacity: 0.55 };

function styling(states: Record<number, "selected">): EdgeStateStyling {
	return { selectedColor: "#fcfffc", stateOf: (edgeIndex) => states[edgeIndex] ?? null };
}

describe("resolveEdgePaint", () => {
	test("uses the edge visual in detail and theme defaults in overview", () => {
		const visual = { color: "#6d5bd0", opacity: 0.3 };
		expect(resolveEdgePaint(0, visual, defaults, "detail", undefined)).toEqual({ color: "#6d5bd0", opacity: 0.3 });
		expect(resolveEdgePaint(0, visual, defaults, "overview", undefined)).toEqual({ color: "#6d5bd0", opacity: 0.55 });
		expect(resolveEdgePaint(0, {}, defaults, "detail", undefined)).toEqual(defaults);
	});

	test("selection replaces the color and keeps the tier opacity", () => {
		const visual = { color: "#6d5bd0", opacity: 0.3 };
		expect(resolveEdgePaint(2, visual, defaults, "detail", styling({ 2: "selected" }))).toEqual({
			color: "#fcfffc",
			opacity: 0.3,
		});
		expect(resolveEdgePaint(1, visual, defaults, "detail", styling({ 2: "selected" }))).toEqual(visual);
	});
});

describe("changedIds", () => {
	test("returns ids present in exactly one set", () => {
		expect(changedIds(new Set(["a", "b"]), new Set(["b", "c"])).sort()).toEqual(["a", "c"]);
		expect(changedIds(new Set(["a"]), new Set(["a"]))).toEqual([]);
	});
});
