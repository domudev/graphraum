import { describe, expect, test } from "vitest";

import { autoControlPoints, DETAIL_MAX_SEGMENTS, sampleEdgePath, segmentCountForPath } from "./edge-paths";

describe("edge-paths", () => {
	test("reports detail segment counts by path and collapses overview", () => {
		expect(DETAIL_MAX_SEGMENTS).toBe(24);
		expect(segmentCountForPath("straight", "detail")).toBe(1);
		expect(segmentCountForPath("quadratic", "detail")).toBe(16);
		expect(segmentCountForPath("cubic", "detail")).toBe(24);
		expect(segmentCountForPath("cubic", "overview")).toBe(1);
	});

	test("derives deterministic auto controls from endpoints", () => {
		const first = autoControlPoints("quadratic", 0, 0, 0, 10, 0, 0);
		const second = autoControlPoints("quadratic", 0, 0, 0, 10, 0, 0);
		expect(first).toEqual(second);
		expect(first).toHaveLength(1);
		expect(first[0]?.x).toBeCloseTo(5);
		expect(first[0]?.y).toBeCloseTo(1.8);
		expect(autoControlPoints("cubic", 0, 0, 0, 9, 0, 0)).toHaveLength(2);
	});

	test("samples include endpoints and the detail segment count", () => {
		const quadratic = sampleEdgePath({
			path: "quadratic",
			controlPoints: [{ x: 5, y: 4, z: 0 }],
			tier: "detail",
			x1: 0,
			y1: 0,
			z1: 0,
			x2: 10,
			y2: 0,
			z2: 0,
		});
		expect(quadratic).toHaveLength(17);
		expect(quadratic[0]).toEqual({ x: 0, y: 0, z: 0 });
		expect(quadratic.at(-1)).toEqual({ x: 10, y: 0, z: 0 });

		const overview = sampleEdgePath({
			path: "cubic",
			controlPoints: undefined,
			tier: "overview",
			x1: 0,
			y1: 0,
			z1: 0,
			x2: 10,
			y2: 0,
			z2: 0,
		});
		expect(overview).toHaveLength(2);
	});
});
