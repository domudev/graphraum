import { expect, test } from "vitest";

import { computeForcePositions, forceIterationCount } from "./force-layout";

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
