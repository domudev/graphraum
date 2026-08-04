import { describe, expect, test } from "vitest";

import { BENCHMARK_NODE_COLORS, createFixture, effectivePixelRatio, summarize } from "./benchmark";

describe("live benchmark helpers", () => {
	test("builds a deterministic three-edges-per-node fixture", () => {
		const first = createFixture(100);
		const second = createFixture(100);

		expect(first).toEqual(second);
		expect(first.nodes).toHaveLength(100);
		expect(first.edges).toHaveLength(300);
		expect(new Set(first.nodes.map((node) => node.color))).toEqual(new Set(BENCHMARK_NODE_COLORS));
		expect(BENCHMARK_NODE_COLORS).not.toContain("#fcfffc");
	});

	test("summarizes empty and populated samples honestly", () => {
		expect(summarize([])).toEqual({
			coefficientOfVariation: null,
			count: 0,
			max: null,
			mean: null,
			min: null,
			p50: null,
			p95: null,
			p99: null,
			standardDeviation: null,
		});
		expect(summarize([40, 10, 30, 20])).toEqual({
			coefficientOfVariation: Math.sqrt(125) / 25,
			count: 4,
			max: 40,
			mean: 25,
			min: 10,
			p50: 20,
			p95: 40,
			p99: 40,
			standardDeviation: Math.sqrt(125),
		});
	});

	test("rejects invalid timing samples", () => {
		expect(() => summarize([12, Number.NaN])).toThrow("finite, non-negative");
		expect(() => summarize([-1])).toThrow("finite, non-negative");
	});

	test("reports the effective renderer pixel ratio", () => {
		expect(effectivePixelRatio(2, 1)).toBe(1);
		expect(effectivePixelRatio(1.5, 2)).toBe(1.5);
		expect(() => effectivePixelRatio(2, 0)).toThrow("Maximum pixel ratio must be positive.");
	});
});
