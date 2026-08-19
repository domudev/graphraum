import { describe, expect, test } from "vitest";

import { orderFocusNodeIds, selectBudgetedLabelIds, selectFocusLabelIds } from "./label-budget";

describe("selectBudgetedLabelIds", () => {
	test("drops non-visible candidates", () => {
		expect(
			selectBudgetedLabelIds({
				candidates: [
					{ id: "a", importance: 10, visible: false },
					{ id: "b", importance: 1, visible: true },
				],
				maxLabels: 10,
			}),
		).toEqual(["b"]);
	});

	test("sorts by importance descending and caps at maxLabels", () => {
		expect(
			selectBudgetedLabelIds({
				candidates: [
					{ id: "low", importance: 1, visible: true },
					{ id: "high", importance: 9, visible: true },
					{ id: "mid", importance: 5, visible: true },
					{ id: "hidden-high", importance: 100, visible: false },
				],
				maxLabels: 2,
			}),
		).toEqual(["high", "mid"]);
	});

	test("breaks importance ties by id ascending for a stable order", () => {
		expect(
			selectBudgetedLabelIds({
				candidates: [
					{ id: "zeta", importance: 3, visible: true },
					{ id: "alpha", importance: 3, visible: true },
					{ id: "mu", importance: 3, visible: true },
				],
				maxLabels: 3,
			}),
		).toEqual(["alpha", "mu", "zeta"]);
	});

	test("returns an empty list when the budget is zero", () => {
		expect(
			selectBudgetedLabelIds({
				candidates: [{ id: "a", importance: 1, visible: true }],
				maxLabels: 0,
			}),
		).toEqual([]);
	});

	test("rejects a non-integer or negative maxLabels", () => {
		expect(() =>
			selectBudgetedLabelIds({
				candidates: [],
				maxLabels: -1,
			}),
		).toThrow("non-negative integer");
		expect(() =>
			selectBudgetedLabelIds({
				candidates: [],
				maxLabels: 1.5,
			}),
		).toThrow("non-negative integer");
	});
});

describe("orderFocusNodeIds", () => {
	test("orders selected, then hovered, then neighbors without duplicates", () => {
		expect(
			orderFocusNodeIds({
				selectedIds: ["s", "shared"],
				hoveredIds: ["h", "shared"],
				neighborIds: ["n", "h", "s"],
			}),
		).toEqual(["s", "shared", "h", "n"]);
	});
});

describe("selectFocusLabelIds", () => {
	test("keeps visible focus ids first, then fills by importance", () => {
		expect(
			selectFocusLabelIds({
				focusIds: ["sel", "hover", "neighbor"],
				candidates: [
					{ id: "sel", importance: 1, visible: true },
					{ id: "hover", importance: 1, visible: true },
					{ id: "neighbor", importance: 1, visible: false },
					{ id: "other-high", importance: 50, visible: true },
					{ id: "other-low", importance: 2, visible: true },
				],
				maxLabels: 3,
			}),
		).toEqual(["sel", "hover", "other-high"]);
	});

	test("respects maxLabels before fillers", () => {
		expect(
			selectFocusLabelIds({
				focusIds: ["a", "b", "c"],
				candidates: [
					{ id: "a", importance: 1, visible: true },
					{ id: "b", importance: 1, visible: true },
					{ id: "c", importance: 1, visible: true },
					{ id: "d", importance: 99, visible: true },
				],
				maxLabels: 2,
			}),
		).toEqual(["a", "b"]);
	});
});
