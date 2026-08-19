import { describe, expect, test } from "vitest";

import { boundOverlayIds, selectRichNodeIds } from "./overlay-budget";

describe("boundOverlayIds", () => {
	test("deduplicates ids and preserves first-seen order", () => {
		expect(boundOverlayIds(["b", "a", "b"], 8, "rich nodes")).toEqual(["b", "a"]);
	});

	test("throws when a manual list exceeds the cap", () => {
		expect(() => boundOverlayIds(["a", "b", "c"], 2, "rich nodes")).toThrow(
			"Overlay supports at most 2 rich nodes (requested 3).",
		);
	});

	test("rejects a non-integer or negative cap", () => {
		expect(() => boundOverlayIds([], -1, "rich nodes")).toThrow("non-negative integer");
		expect(() => boundOverlayIds([], 1.5, "rich nodes")).toThrow("non-negative integer");
	});
});

describe("selectRichNodeIds", () => {
	test("selected policy uses selection order and slices to the cap", () => {
		expect(
			selectRichNodeIds({
				hoveredIds: ["h"],
				maxRichNodes: 2,
				policy: "selected",
				selectedIds: ["a", "b", "c"],
			}),
		).toEqual(["a", "b"]);
	});

	test("hovered policy prefers hover then selection", () => {
		expect(
			selectRichNodeIds({
				hoveredIds: ["h"],
				maxRichNodes: 3,
				policy: "hovered",
				selectedIds: ["a", "h"],
			}),
		).toEqual(["h", "a"]);
	});

	test("focus policy is selected then hovered without neighbors", () => {
		expect(
			selectRichNodeIds({
				hoveredIds: ["h", "n"],
				maxRichNodes: 8,
				policy: "focus",
				selectedIds: ["s", "h"],
			}),
		).toEqual(["s", "h", "n"]);
	});
});
