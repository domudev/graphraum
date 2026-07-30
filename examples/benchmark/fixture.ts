import type { GraphraumData, GraphraumNodeShape } from "../../src";

export type NodeKind = "concept" | "document" | "person";
export type EdgeKind = "mentions" | "related";
export type Encoding = "mapper" | "snapshot";
export type EdgeDistribution = "linear" | "random";

export type NodeAttributes = {
	kind: NodeKind;
	score: number;
	useTheme: boolean;
};

export type EdgeAttributes = {
	kind: EdgeKind;
	useTheme: boolean;
};

export interface FixtureOptions {
	edgeDistribution: EdgeDistribution;
	edgeColors: Record<EdgeKind, string>;
	edgeMultiplier: number;
	encoding: Encoding;
	nodeColors: Record<NodeKind, string>;
	nodeCount: number;
	nodeShapes: Record<NodeKind, GraphraumNodeShape>;
	nodeSize: number;
	scoreSize: number;
}

const nodeKinds = ["concept", "document", "person"] as const;

function deterministicRandom(seed: number) {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return { seed, random: (seed >>> 0) / 0x1_0000_0000 };
}

function nextRandomNode(count: number, seedRef: { value: number }) {
	const next = deterministicRandom(seedRef.value);
	seedRef.value = next.seed;
	return Math.floor(next.random * count);
}

export function createFixture(options: FixtureOptions): GraphraumData<NodeAttributes, EdgeAttributes> {
	if (options.nodeCount <= 0) return { edges: [], nodes: [] };
	const edgeCount = options.nodeCount * options.edgeMultiplier;
	const columns = Math.ceil(Math.sqrt(options.nodeCount));
	const randomSeed = {
		value:
			(options.nodeCount * 17_827_199 +
				options.edgeMultiplier * 11_123_579 +
				(options.encoding === "snapshot" ? 1 : 0)) >>>
			0,
	};
	const nodes = Array.from({ length: options.nodeCount }, (_, index) => {
		const kind = nodeKinds[index % nodeKinds.length];
		const score = (index % 5) / 5;
		const useTheme = index % 10 === 0;
		return {
			attributes: { kind, score, useTheme },
			...(options.encoding === "snapshot"
				? {
						...(useTheme ? {} : { color: options.nodeColors[kind] }),
						shape: options.nodeShapes[kind],
						size: options.nodeSize + score * options.scoreSize,
					}
				: {}),
			id: `node-${index}`,
			position: {
				x: (index % columns) * 12,
				y: Math.floor(index / columns) * 12,
				z: ((index * 17) % 101) - 50,
			},
		};
	});
	const edges = Array.from({ length: edgeCount }, (_, index) => {
		const kind: EdgeKind = index % 4 === 0 ? "mentions" : "related";
		const useTheme = index % 10 === 0;
		const source = index % options.nodeCount;
		let target =
			options.edgeDistribution === "linear"
				? (index * 97 + 13) % options.nodeCount
				: nextRandomNode(options.nodeCount, randomSeed);
		if (target === source && options.nodeCount > 1) target = (target + 1) % options.nodeCount;
		return {
			attributes: { kind, useTheme },
			...(options.encoding === "snapshot" && !useTheme ? { color: options.edgeColors[kind] } : {}),
			id: `edge-${index}`,
			source: `node-${source}`,
			target: `node-${target}`,
		};
	});
	return { edges, nodes };
}
