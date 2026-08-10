import { describe, expect, test } from "vitest";

import { distanceSquaredToSegment2d, pickClosestEdgeIndex } from "./edge-picking";

describe("distanceSquaredToSegment2d", () => {
	test("measures perpendicular distance to the segment interior", () => {
		expect(distanceSquaredToSegment2d(0, 5, -10, 0, 10, 0)).toBe(25);
	});

	test("clamps to the nearer endpoint past the segment ends", () => {
		expect(distanceSquaredToSegment2d(20, 0, -10, 0, 10, 0)).toBe(100);
		expect(distanceSquaredToSegment2d(-20, 3, -10, 0, 10, 0)).toBe(100 + 9);
	});
});

describe("pickClosestEdgeIndex", () => {
	test("returns null when the pointer is outside every hit slop", () => {
		expect(
			pickClosestEdgeIndex({ x: 0, y: 20 }, [{ edgeIndex: 0, hitSlop: 4, x1: -10, y1: 0, x2: 10, y2: 0 }]),
		).toBeNull();
	});

	test("hits the only nearby edge", () => {
		expect(pickClosestEdgeIndex({ x: 0, y: 2 }, [{ edgeIndex: 3, hitSlop: 4, x1: -10, y1: 0, x2: 10, y2: 0 }])).toBe(3);
	});

	test("prefers the nearer of two overlapping edges", () => {
		expect(
			pickClosestEdgeIndex({ x: 0, y: 1 }, [
				{ edgeIndex: 0, hitSlop: 8, x1: -10, y1: 0, x2: 10, y2: 0 },
				{ edgeIndex: 1, hitSlop: 8, x1: -10, y1: 3, x2: 10, y2: 3 },
			]),
		).toBe(0);
	});
});
