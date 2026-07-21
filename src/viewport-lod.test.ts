import { describe, expect, test } from "vitest";

import { applyEdgeBudget, collectIncidentEdges } from "./viewport-lod";

describe("viewport LOD", () => {
	test("collects unique incident edges without a full edge scan", () => {
		expect(
			collectIncidentEdges(
				[0, 2],
				[
					[0, 1],
					[1, 2],
					[2, 3],
				],
			),
		).toEqual([0, 1, 2, 3]);
	});

	test("keeps detail edges or applies an evenly distributed overview budget", () => {
		expect(applyEdgeBudget([2, 4], 3)).toEqual([2, 4]);
		expect(applyEdgeBudget([0, 1, 2, 3, 4, 5], 3)).toEqual([0, 2, 4]);
		expect(() => applyEdgeBudget([1], 0)).toThrow("positive integer");
	});
});
