import type { GraphraumData, GraphraumNodeShape } from "../../src";

export type NodeKind = "concept" | "document" | "person";
export type EdgeKind = "mentions" | "related";
export type Encoding = "mapper" | "snapshot";

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

export function createFixture(options: FixtureOptions): GraphraumData<NodeAttributes, EdgeAttributes> {
	const edgeCount = options.nodeCount * options.edgeMultiplier;
	const columns = Math.ceil(Math.sqrt(options.nodeCount));
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
		return {
			attributes: { kind, useTheme },
			...(options.encoding === "snapshot" && !useTheme ? { color: options.edgeColors[kind] } : {}),
			id: `edge-${index}`,
			source: `node-${index % options.nodeCount}`,
			target: `node-${(index * 97 + 13) % options.nodeCount}`,
		};
	});
	return { edges, nodes };
}
