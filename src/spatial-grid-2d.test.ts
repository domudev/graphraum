import { describe, expect, test } from "vitest";

import { SpatialGrid2D } from "./spatial-grid-2d";

describe("SpatialGrid2D", () => {
	test("picks the nearest overlapping node across cell boundaries", () => {
		const grid = new SpatialGrid2D(10);
		grid.set(0, { id: "left", position: { x: 9, y: 5 }, size: 3 });
		grid.set(1, { id: "right", position: { x: 11, y: 5 }, size: 3 });
		expect(grid.pick(10.75, 5)).toBe(1);
		expect(grid.pick(30, 30)).toBeNull();
	});

	test("moves nodes without leaving stale memberships", () => {
		const grid = new SpatialGrid2D(10);
		grid.set(4, { id: "moving", position: { x: 1, y: 1 }, size: 2 });
		grid.set(4, { id: "moving", position: { x: 101, y: 101 }, size: 2 });
		expect(grid.pick(1, 1)).toBeNull();
		expect(grid.pick(101, 101)).toBe(4);
	});

	test("queries visible nodes with overscan", () => {
		const grid = new SpatialGrid2D(10);
		grid.set(0, { id: "visible", position: { x: 5, y: 5 }, size: 1 });
		grid.set(1, { id: "overscan", position: { x: 14, y: 5 }, size: 1 });
		grid.set(2, { id: "hidden", position: { x: 30, y: 5 }, size: 1 });
		grid.set(3, { id: "intersecting", position: { x: 20, y: 5 }, size: 11 });
		expect(grid.queryBounds({ bottom: 0, left: 0, right: 10, top: 10 }, 5)).toEqual([0, 1, 3]);
	});
});
