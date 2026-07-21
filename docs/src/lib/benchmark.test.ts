import { describe, expect, test } from "vitest";

import { createFixture, summarize } from "./benchmark";

describe("live benchmark helpers", () => {
	test("builds a deterministic three-edges-per-node fixture", () => {
		const first = createFixture(100);
		const second = createFixture(100);

		expect(first).toEqual(second);
		expect(first.nodes).toHaveLength(100);
		expect(first.edges).toHaveLength(300);
	});

	test("summarizes empty and populated samples honestly", () => {
		expect(summarize([])).toEqual({ count: 0, p50: null, p95: null, max: null });
		expect(summarize([40, 10, 30, 20])).toEqual({ count: 4, p50: 20, p95: 40, max: 40 });
	});
});
