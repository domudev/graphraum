import type { GraphraumData } from "@domudev/graphraum";

export interface BenchmarkStatistics {
	count: number;
	p50: number | null;
	p95: number | null;
	max: number | null;
}

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

export function createFixture(nodeCount: number): GraphraumData {
	if (!Number.isSafeInteger(nodeCount) || nodeCount < 2)
		throw new Error("A benchmark fixture needs at least two nodes.");
	const edgeCount = nodeCount * 3;
	const columns = Math.ceil(Math.sqrt(nodeCount));
	return {
		nodes: Array.from({ length: nodeCount }, (_, index) => ({
			id: `node-${index}`,
			position: {
				x: (index % columns) * 12,
				y: Math.floor(index / columns) * 12,
				z: ((index * 17) % 101) - 50,
			},
			color: index === 0 ? "#f59e0b" : index % 11 === 0 ? "#38bdf8" : "#a1a1aa",
			size: 2.5,
		})),
		edges: Array.from({ length: edgeCount }, (_, index) => ({
			id: `edge-${index}`,
			source: `node-${index % nodeCount}`,
			target: `node-${(index * 97 + 13) % nodeCount}`,
		})),
	};
}
