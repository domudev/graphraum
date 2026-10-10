import { describe, expect, test } from "vitest";

import {
	CLUSTER_SPREAD_RATIO,
	clusterSpreadRatio,
	normalizeExtent,
	STRESS_UNITS_PER_NODE,
	spreadClusters,
} from "./stress-layout";

/** Two clusters of two nodes, 100 apart, each node 1 from its centroid. */
function tightPair() {
	return {
		clusters: Uint32Array.from([0, 0, 1, 1]),
		positions: Float32Array.from([-1, 0, 0, 1, 0, 0, 99, 0, 0, 101, 0, 0]),
	};
}

describe("spreadClusters", () => {
	test("measures spread against the gap to the nearest cluster", () => {
		const { clusters, positions } = tightPair();
		expect(clusterSpreadRatio(positions, clusters)).toBeCloseTo(0.01);
	});

	test("widens tight clusters around their centroids up to six times", () => {
		const { clusters, positions } = tightPair();
		spreadClusters(positions, clusters);

		expect(Array.from(positions)).toEqual([-6, 0, 0, 6, 0, 0, 94, 0, 0, 106, 0, 0]);
	});

	test("reaches the target ratio when the cap allows it", () => {
		const clusters = Uint32Array.from([0, 0, 1, 1]);
		const positions = Float32Array.from([-10, 0, 0, 10, 0, 0, 90, 0, 0, 110, 0, 0]);
		spreadClusters(positions, clusters);

		expect(clusterSpreadRatio(positions, clusters)).toBeCloseTo(CLUSTER_SPREAD_RATIO);
	});

	test("leaves wide clusters and single clusters alone", () => {
		const wide = Float32Array.from([-40, 0, 0, 40, 0, 0, 60, 0, 0, 140, 0, 0]);
		expect(Array.from(spreadClusters(wide.slice(), Uint32Array.from([0, 0, 1, 1])))).toEqual(Array.from(wide));
		const single = Float32Array.from([0, 0, 0, 1, 0, 0]);
		expect(Array.from(spreadClusters(single.slice(), Uint32Array.from([0, 0])))).toEqual(Array.from(single));
	});
});

describe("normalizeExtent", () => {
	test("scales the larger side to the target span around the centre", () => {
		const positions = Float32Array.from([0, 0, 0, 1000, 500, 0, 500, 250, 0, 250, 0, 0]);
		normalizeExtent(positions, 4);

		const span = 2 * STRESS_UNITS_PER_NODE;
		expect(positions[0]).toBeCloseTo(500 - span / 2);
		expect(positions[3]).toBeCloseTo(500 + span / 2);
		expect(positions[6]).toBeCloseTo(500);
	});

	test("leaves a single point alone", () => {
		expect(Array.from(normalizeExtent(Float32Array.from([3, 4, 5]), 1))).toEqual([3, 4, 5]);
	});
});
