import type {
	GraphraumData,
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

export function createPlaygroundFixture(
	nodeCount: number,
): GraphraumData<PlaygroundNodeAttributes, PlaygroundEdgeAttributes> {
	if (!Number.isSafeInteger(nodeCount) || nodeCount < 2) {
		throw new Error("A playground fixture needs at least two nodes.");
	}
	const edgeCount = nodeCount * 3;
	const columns = Math.ceil(Math.sqrt(nodeCount));
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
		edges: Array.from({ length: edgeCount }, (_, index) => ({
			attributes: { kind: index % 4 === 0 ? "mentions" : "related" },
			id: `edge-${index}`,
			source: `node-${index % nodeCount}`,
			target: `node-${(index * 97 + 13) % nodeCount}`,
		})),
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
