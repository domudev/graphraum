import { expect, test } from "vitest";

import { computeClusteredForcePositions, computeForcePositions, forceIterationCount } from "./force-layout";

test("keeps 2D force positions flat and gives 3D positions depth", () => {
	const edges = new Uint32Array([0, 1, 1, 2]);
	const flat = computeForcePositions({ dimensions: 2, edges, nodeCount: 4 });
	const spatial = computeForcePositions({ dimensions: 3, edges, nodeCount: 4 });

	expect(Array.from(flat.filter((_, index) => index % 3 === 2))).toEqual([0, 0, 0, 0]);
	expect(Array.from(spatial.filter((_, index) => index % 3 === 2))).not.toEqual([0, 0, 0, 0]);
});

test("reduces force iterations as node count grows", () => {
	expect(forceIterationCount(100)).toBeGreaterThan(forceIterationCount(10_000));
	expect(forceIterationCount(10_000)).toBeGreaterThan(forceIterationCount(100_000));
	expect(forceIterationCount(1_000_000)).toBeGreaterThanOrEqual(8);
});

test("keeps a 10k-node force layout finite", () => {
	const nodeCount = 10_000;
	const edges = new Uint32Array((nodeCount - 1) * 2);
	for (let index = 0; index < nodeCount - 1; index += 1) edges.set([index, index + 1], index * 2);

	const positions = computeForcePositions({ dimensions: 3, edges, nodeCount });

	expect(positions.every(Number.isFinite)).toBe(true);
});

test("does not preserve a circular seed", () => {
	const positions = computeForcePositions({ dimensions: 2, edges: new Uint32Array(), nodeCount: 64 });
	const radii = Array.from({ length: 64 }, (_, index) =>
		Math.round(Math.hypot(positions[index * 3] ?? 0, positions[index * 3 + 1] ?? 0)),
	);

	expect(new Set(radii).size).toBeGreaterThan(10);
});

test("expands a coarse force layout from data cluster indices", () => {
	const positions = computeClusteredForcePositions({
		clusters: new Uint32Array([0, 0, 1, 1]),
		dimensions: 2,
		edges: new Uint32Array([0, 1, 2, 3, 1, 2]),
		nodeCount: 4,
	});
	const distance = (left: number, right: number) =>
		Math.hypot(positions[left * 3] - positions[right * 3], positions[left * 3 + 1] - positions[right * 3 + 1]);

	expect(distance(0, 1)).toBeLessThan(distance(0, 2));
	expect(positions.filter((_, index) => index % 3 === 2).every((value) => value === 0)).toBe(true);
});
