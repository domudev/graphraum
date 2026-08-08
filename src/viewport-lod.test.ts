import { describe, expect, test } from "vitest";

import { applyEdgeBudget, collectIncidentEdges, resolveLodLevel, shouldUseDensityLod } from "./viewport-lod";

describe("viewport LOD", () => {
	test("resolves the diagnostics/edge LOD tier from density and edge budget state", () => {
		expect(resolveLodLevel(true, 10, 5)).toBe("density");
		expect(resolveLodLevel(false, 10, 5)).toBe("overview");
		expect(resolveLodLevel(false, 5, 5)).toBe("detail");
	});

	test("uses hysteresis around the visible-node budget", () => {
		expect(shouldUseDensityLod(110, 100, false)).toBe(false);
		expect(shouldUseDensityLod(111, 100, false)).toBe(true);
		expect(shouldUseDensityLod(86, 100, true)).toBe(true);
		expect(shouldUseDensityLod(85, 100, true)).toBe(false);
	});

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
