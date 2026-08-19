import { expect, test } from "vitest";

import {
	computeClusteredForcePositions,
	computeForcePositions,
	createForceSimulation,
	DEFAULT_FORCE_SETTINGS,
	forceIterationCount,
} from "./force-layout";

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

test("honors an explicit iteration count", () => {
	const request = { dimensions: 2 as const, edges: new Uint32Array([0, 1]), nodeCount: 8 };
	const once = computeForcePositions({ ...request, iterations: 1 });
	const twice = computeForcePositions({ ...request, iterations: 2 });
	expect(twice).not.toEqual(once);
	expect(() => computeForcePositions({ ...request, iterations: 0 })).toThrow(/positive integer/);
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

test("applies force settings and recenters every live step", () => {
	const request = { dimensions: 2 as const, edges: new Uint32Array([0, 1, 1, 2]), nodeCount: 4 };
	const baseline = computeForcePositions(request);
	const tuned = computeForcePositions({
		...request,
		settings: { ...DEFAULT_FORCE_SETTINGS, repulsion: 2_000, springStrength: 0.02 },
	});
	const simulation = createForceSimulation(request);
	simulation.step(0.35);
	const center = [0, 0];
	for (let index = 0; index < request.nodeCount; index += 1) {
		center[0] += simulation.positions[index * 3] ?? 0;
		center[1] += simulation.positions[index * 3 + 1] ?? 0;
	}

	expect(tuned).not.toEqual(baseline);
	expect(center[0] / request.nodeCount).toBeCloseTo(0, 5);
	expect(center[1] / request.nodeCount).toBeCloseTo(0, 5);
});

test("adds nodes and edges without resetting existing layout state", () => {
	const simulation = createForceSimulation({ dimensions: 2, edges: new Uint32Array([0, 1]), nodeCount: 2 });
	simulation.step(0.35);
	const before = Array.from(simulation.positions.slice(0, 6));

	const start = simulation.addNodes(1, new Float32Array([12, 8, 0]));
	simulation.addEdges(new Uint32Array([1, start]));

	expect(start).toBe(2);
	expect(simulation.nodeCount).toBe(3);
	expect(Array.from(simulation.positions.slice(0, 6))).toEqual(before);
	expect(Array.from(simulation.edges)).toEqual([0, 1, 1, 2]);
	simulation.step(0.2);
	expect(simulation.positions.every(Number.isFinite)).toBe(true);
});
