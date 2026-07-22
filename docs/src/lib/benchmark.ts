import type { GraphraumData } from "@domudev/graphraum";

export interface BenchmarkStatistics {
	count: number;
	p50: number | null;
	p95: number | null;
	max: number | null;
}

export const BENCHMARK_NODE_COLORS = ["#226f54", "#347f63", "#469878", "#5caf8d", "#73c7a5"] as const;

export function summarize(samples: readonly number[]): BenchmarkStatistics {
	if (samples.length === 0) return { count: 0, p50: null, p95: null, max: null };
	const sorted = samples.toSorted((left, right) => left - right);
	const percentile = (value: number) => sorted[Math.ceil((value / 100) * sorted.length) - 1] ?? null;
	return {
		count: sorted.length,
		p50: percentile(50),
		p95: percentile(95),
		max: sorted.at(-1) ?? null,
	};
}

export function effectivePixelRatio(devicePixelRatio: number, maxPixelRatio: number) {
	if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0)
		throw new Error("Device pixel ratio must be positive.");
	if (!Number.isFinite(maxPixelRatio) || maxPixelRatio <= 0) throw new Error("Maximum pixel ratio must be positive.");
	return Math.min(devicePixelRatio, maxPixelRatio);
}

export function createFixture(nodeCount: number): GraphraumData {
	if (!Number.isSafeInteger(nodeCount) || nodeCount < 2)
		throw new Error("A benchmark fixture needs at least two nodes.");
	const edgeCount = nodeCount * 3;
	const columns = Math.ceil(Math.sqrt(nodeCount));
	return {
		nodes: Array.from({ length: nodeCount }, (_, index) => {
			const row = Math.floor(index / columns);
			return {
				id: `node-${index}`,
				position: {
					x: (index % columns) * 12,
					y: row * 12,
					z: ((index * 17) % 101) - 50,
				},
				color: BENCHMARK_NODE_COLORS[(index * 7 + row * 3) % BENCHMARK_NODE_COLORS.length] ?? "#226f54",
				size: 2.5,
			};
		}),
		edges: Array.from({ length: edgeCount }, (_, index) => ({
			id: `edge-${index}`,
			source: `node-${index % nodeCount}`,
			target: `node-${(index * 97 + 13) % nodeCount}`,
		})),
	};
}
