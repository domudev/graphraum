import { expect, test } from "vitest";

import { attachPointOnOutline, DEFAULT_ENDPOINT_CLEARANCE, trimEdgeEndpoints } from "./edge-endpoint-attach";

test("circle attach lands outside the fill and inside the stroke pad", () => {
	const center = { x: 0, y: 0, z: 0 };
	const far = { x: 40, y: 0, z: 0 };
	const point = attachPointOnOutline(center, far, { shape: "circle", size: 4, strokeWidth: 1 }, 0.5);
	expect(point.y).toBeCloseTo(0, 5);
	expect(point.x).toBeGreaterThan(3);
	expect(point.x).toBeLessThan(5);
});

test("diamond attach respects the diamond outline", () => {
	const center = { x: 0, y: 0, z: 0 };
	const far = { x: 40, y: 40, z: 0 };
	const point = attachPointOnOutline(center, far, { shape: "diamond", size: 4 }, 0);
	// Diamond boundary along y=x is at local |x|+|y|=1 → world distance 2√2 for size 4.
	expect(Math.hypot(point.x, point.y)).toBeCloseTo(2 * Math.SQRT2, 1);
});

test("clearance does not invert a short edge", () => {
	const trimmed = trimEdgeEndpoints({
		source: { x: 0, y: 0 },
		target: { x: 3, y: 0 },
		sourceOutline: { shape: "circle", size: 4 },
		targetOutline: { shape: "circle", size: 4 },
		clearance: DEFAULT_ENDPOINT_CLEARANCE,
	});
	// Overlapping outlines → fall back to centers rather than crossing.
	expect(trimmed.source.x).toBe(0);
	expect(trimmed.target.x).toBe(3);
});

test("center attach leaves endpoints unchanged", () => {
	const trimmed = trimEdgeEndpoints({
		attach: "center",
		source: { x: 1, y: 2, z: 3 },
		target: { x: 4, y: 5, z: 6 },
		sourceOutline: { shape: "circle", size: 4 },
		targetOutline: { shape: "circle", size: 4 },
	});
	expect(trimmed.source).toEqual({ x: 1, y: 2, z: 3 });
	expect(trimmed.target).toEqual({ x: 4, y: 5, z: 6 });
});

test("boundary trim shortens a long straight chord", () => {
	const trimmed = trimEdgeEndpoints({
		source: { x: 0, y: 0 },
		target: { x: 40, y: 0 },
		sourceOutline: { shape: "circle", size: 4, strokeWidth: 1 },
		targetOutline: { shape: "circle", size: 4, strokeWidth: 1 },
		clearance: 0.5,
	});
	expect(trimmed.source.x).toBeGreaterThan(3);
	expect(trimmed.target.x).toBeLessThan(37);
	expect(trimmed.target.x - trimmed.source.x).toBeLessThan(40);
});
