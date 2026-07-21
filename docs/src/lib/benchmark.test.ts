import { describe, expect, test } from "vitest";

import { createFixture, effectivePixelRatio, summarize } from "./benchmark";

describe("live benchmark helpers", () => {
	test("builds a deterministic three-edges-per-node fixture", () => {
		const first = createFixture(100);
		const second = createFixture(100);

		expect(first).toEqual(second);
		expect(first.nodes).toHaveLength(100);
		expect(first.edges).toHaveLength(300);
		expect(first.nodes[0]?.color).toBe("#fcfffc");
		expect(first.nodes[1]?.color).toBeUndefined();
		expect(first.nodes[11]?.color).toBe("#73c7a5");
	});

	test("summarizes empty and populated samples honestly", () => {
		expect(summarize([])).toEqual({ count: 0, p50: null, p95: null, max: null });
		expect(summarize([40, 10, 30, 20])).toEqual({ count: 4, p50: 20, p95: 40, max: 40 });
	});

	test("reports the effective renderer pixel ratio", () => {
		expect(effectivePixelRatio(2, 1)).toBe(1);
		expect(effectivePixelRatio(1.5, 2)).toBe(1.5);
		expect(() => effectivePixelRatio(2, 0)).toThrow("Maximum pixel ratio must be positive.");
	});
});
