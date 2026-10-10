import type {
	GraphraumData,
	GraphraumEdge,
	GraphraumEdgeMarker,
	GraphraumEdgeMarkerEnd,
	GraphraumEdgePath,
	GraphraumEdgeStyle,
	GraphraumNodeShape,
} from "../../../src/types";
import { defineVisuals } from "../../../src/visuals";

export type PlaygroundNodeKind = "concept" | "document" | "person";
export type PlaygroundEdgeKind = "mentions" | "related";

export type PlaygroundNodeAttributes = {
	kind: PlaygroundNodeKind;
	score: number;
};

export type PlaygroundEdgeAttributes = {
	kind: PlaygroundEdgeKind;
};

export interface PlaygroundAppearance {
	edgeMarker: GraphraumEdgeMarker;
	edgeMarkerEnd: GraphraumEdgeMarkerEnd;
	edgeOpacity: number;
	edgePath: GraphraumEdgePath;
	edgeStyle: GraphraumEdgeStyle;
	edgeWidth: number;
	nodeAspect: number;
	nodeColors: Record<PlaygroundNodeKind, string>;
	nodeCount: number;
	nodeShapes: Record<PlaygroundNodeKind, GraphraumNodeShape>;
	nodeSize: number;
	nodeStrokeColor: string;
	nodeStrokeWidth: number;
	scoreSize: number;
}

export const playgroundNodeKinds = ["concept", "document", "person"] as const;
export const playgroundNodeShapes = [
	"circle",
	"square",
	"diamond",
	"hexagon",
	"triangle",
	"pill",
	"rounded",
] as const satisfies readonly GraphraumNodeShape[];

export const defaultPlaygroundAppearance = (): PlaygroundAppearance => ({
	edgeMarker: "none",
	edgeMarkerEnd: "target",
	edgeOpacity: 0.85,
	edgePath: "straight",
	edgeStyle: "solid",
	edgeWidth: 1.5,
	nodeAspect: 1,
	nodeColors: {
		concept: "#e4a853",
		document: "#73c7a5",
		person: "#fcfffc",
	},
	nodeCount: 1_000,
	nodeShapes: {
		concept: "diamond",
		document: "square",
		person: "circle",
	},
	nodeSize: 3,
	nodeStrokeColor: "#fcfffc",
	nodeStrokeWidth: 0,
	scoreSize: 4,
});

/** Nodes per community in the stress fixture; about the size of one readable cluster. */
export const PLAYGROUND_CLUSTER_SIZE = 60;
/** One edge in this many leaves its community, so clusters stay connected but distinct. */
const BRIDGE_EVERY = 12;

/** Nodes per community for a fixture of this size; communities are contiguous index ranges. */
export function playgroundClusterSpan(nodeCount: number, clusterSize = PLAYGROUND_CLUSTER_SIZE) {
	return Math.ceil(nodeCount / Math.max(1, Math.round(nodeCount / clusterSize)));
}

/** Community index per node, matching {@link createPlaygroundFixture}; seeds the force layout. */
export function playgroundClusters(nodeCount: number, clusterSize = PLAYGROUND_CLUSTER_SIZE): Uint32Array {
	const span = playgroundClusterSpan(nodeCount, clusterSize);
	return Uint32Array.from({ length: nodeCount }, (_, index) => Math.floor(index / span));
}

/** Deterministic integer hash (xorshift-multiply), so the fixture is identical on every run. */
function hash(value: number) {
	let h = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A clustered stress fixture: contiguous communities of about {@link PLAYGROUND_CLUSTER_SIZE} nodes,
 * each a tree around its first node plus random links inside the community, and one in
 * {@link BRIDGE_EVERY} edges bridging to one of the next three communities. Three edges per node, as before.
 * A random graph without communities lays out as a uniform hairball at any force setting.
 */
export function createPlaygroundFixture(
	nodeCount: number,
	clusterSize = PLAYGROUND_CLUSTER_SIZE,
): GraphraumData<PlaygroundNodeAttributes, PlaygroundEdgeAttributes> {
	if (!Number.isSafeInteger(nodeCount) || nodeCount < 2) {
		throw new Error("A playground fixture needs at least two nodes.");
	}
	const span = playgroundClusterSpan(nodeCount, clusterSize);
	const clusterCount = Math.ceil(nodeCount / span);
	const clusterStart = (cluster: number) => cluster * span;
	const columns = Math.ceil(Math.sqrt(nodeCount));

	const edges: GraphraumEdge<PlaygroundEdgeAttributes>[] = [];
	for (let index = 0; index < nodeCount; index += 1) {
		const cluster = Math.floor(index / span);
		const start = clusterStart(cluster);
		const size = Math.min(span, nodeCount - start);
		const local = index - start;
		const parent =
			local > 0
				? start + ((local - 1) >> 1)
				: cluster > 0
					? clusterStart(hash(cluster) % cluster)
					: Math.min(1, nodeCount - 1);
		const inCluster = (salt: number) => {
			if (size < 2) return parent;
			const target = start + (hash(index * 3 + salt) % size);
			return target === index ? start + ((local + 1) % size) : target;
		};
		const bridge = (index + 1) % BRIDGE_EVERY === 0 && clusterCount > 1;
		const third = bridge
			? clusterStart((cluster + 1 + (hash(index) % Math.min(3, clusterCount - 1))) % clusterCount)
			: inCluster(2);
		for (const [slot, target] of [parent, inCluster(1), third].entries()) {
			const edgeIndex = index * 3 + slot;
			edges.push({
				attributes: { kind: edgeIndex % 4 === 0 ? "mentions" : "related" },
				id: `edge-${edgeIndex}`,
				source: `node-${index}`,
				target: `node-${target}`,
			});
		}
	}

	return {
		nodes: Array.from({ length: nodeCount }, (_, index) => {
			const kind = playgroundNodeKinds[index % playgroundNodeKinds.length];
			return {
				attributes: { kind, score: (index % 5) / 5 },
				id: `node-${index}`,
				position: {
					x: (index % columns) * 12,
					y: Math.floor(index / columns) * 12,
					z: ((index * 17) % 101) - 50,
				},
			};
		}),
		edges,
	};
}

export function createPlaygroundVisuals(appearance: PlaygroundAppearance) {
	return defineVisuals<PlaygroundNodeAttributes, PlaygroundEdgeAttributes>({
		edge: (edge) => ({
			visual: {
				color: edge.attributes.kind === "mentions" ? "#2d8b6a" : "#226f54",
				marker: appearance.edgeMarker,
				markerEnd: appearance.edgeMarkerEnd,
				opacity: appearance.edgeOpacity,
				path: appearance.edgePath,
				style: appearance.edgeStyle,
				width: appearance.edgeWidth,
			},
		}),
		node: (node) => {
			const height = appearance.nodeSize + node.attributes.score * appearance.scoreSize;
			const index = Number(node.id.slice(5));
			return {
				presentation: {
					actions: [{ id: "inspect", label: "Inspect" }],
					subtitle: node.attributes.kind,
					title: `${node.attributes.kind}-${Number.isFinite(index) ? index : node.id}`,
				},
				visual: {
					color: appearance.nodeColors[node.attributes.kind],
					height,
					shape: appearance.nodeShapes[node.attributes.kind],
					strokeColor: appearance.nodeStrokeColor,
					strokeWidth: appearance.nodeStrokeWidth,
					width: height * appearance.nodeAspect,
				},
			};
		},
	});
}
