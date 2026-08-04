import type Graph from "graphology";

import type { GraphraumColor, GraphraumNodeShape, GraphraumNodeUpdate } from "./types";

export type GraphologyNodeAttributes = Record<string, unknown> & {
	color?: GraphraumColor;
	shape?: GraphraumNodeShape;
	size?: number;
	x?: number;
	y?: number;
	z?: number;
};

export type GraphologyEdgeAttributes = Record<string, unknown> & {
	color?: GraphraumColor;
};

interface GraphologyData<NodeAttributes, EdgeAttributes> {
	nodes: readonly {
		attributes: NodeAttributes;
		color?: GraphraumColor;
		id: string;
		position: { x: number; y: number; z?: number };
		shape?: GraphraumNodeShape;
		size?: number;
	}[];
	edges: readonly {
		attributes: EdgeAttributes;
		color?: GraphraumColor;
		id: string;
		source: string;
		target: string;
	}[];
}

export interface GraphologyRenderer<NodeAttributes, EdgeAttributes> {
	setData(data: GraphologyData<NodeAttributes, EdgeAttributes>): void;
	updateNodes(updates: readonly GraphraumNodeUpdate[]): void;
}

function projectGraphology<
	NodeAttributes extends GraphologyNodeAttributes,
	EdgeAttributes extends GraphologyEdgeAttributes,
>(graph: Graph<NodeAttributes, EdgeAttributes>): GraphologyData<NodeAttributes, EdgeAttributes> {
	const nodes: GraphologyData<NodeAttributes, EdgeAttributes>["nodes"][number][] = [];
	const edges: GraphologyData<NodeAttributes, EdgeAttributes>["edges"][number][] = [];
	graph.forEachNode((id, attributes) => {
		nodes.push({
			attributes,
			color: attributes.color,
			id,
			position: { x: attributes.x ?? 0, y: attributes.y ?? 0, z: attributes.z },
			shape: attributes.shape,
			size: attributes.size,
		});
	});
	graph.forEachEdge((id, attributes, source, target) => {
		edges.push({ attributes, color: attributes.color, id, source, target });
	});
	return { edges, nodes };
}

/** Projects a mutable Graphology graph into Graphraum and keeps the binding alive until disposed. */
export function bindGraphology<
	NodeAttributes extends GraphologyNodeAttributes,
	EdgeAttributes extends GraphologyEdgeAttributes,
>(
	renderer: GraphologyRenderer<NodeAttributes, EdgeAttributes>,
	graph: Graph<NodeAttributes, EdgeAttributes>,
): () => void {
	renderer.setData(projectGraphology(graph));
	const pendingNodes = new Set<string>();
	let flushPending = false;
	let topologyChanged = false;
	let disposed = false;
	const flush = () => {
		flushPending = false;
		if (disposed) return;
		if (topologyChanged) {
			topologyChanged = false;
			pendingNodes.clear();
			renderer.setData(projectGraphology(graph));
			return;
		}
		const updates = [...pendingNodes]
			.filter((id) => graph.hasNode(id))
			.map((id) => {
				const attributes = graph.getNodeAttributes(id);
				return {
					color: attributes.color,
					id,
					position: { x: attributes.x ?? 0, y: attributes.y ?? 0, z: attributes.z },
					shape: attributes.shape,
					size: attributes.size,
				};
			});
		pendingNodes.clear();
		if (updates.length > 0) renderer.updateNodes(updates);
	};
	const scheduleFlush = () => {
		if (flushPending) return;
		flushPending = true;
		queueMicrotask(flush);
	};
	const scheduleNode = ({ key }: { key: string }) => {
		pendingNodes.add(key);
		scheduleFlush();
	};
	const scheduleAllNodes = () => {
		graph.forEachNode((id) => pendingNodes.add(id));
		scheduleFlush();
	};
	const scheduleTopology = () => {
		topologyChanged = true;
		scheduleFlush();
	};
	graph.on("nodeAttributesUpdated", scheduleNode);
	graph.on("eachNodeAttributesUpdated", scheduleAllNodes);
	graph.on("nodeAdded", scheduleTopology);
	graph.on("nodeDropped", scheduleTopology);
	graph.on("edgeAdded", scheduleTopology);
	graph.on("edgeDropped", scheduleTopology);
	graph.on("edgeAttributesUpdated", scheduleTopology);
	graph.on("eachEdgeAttributesUpdated", scheduleTopology);
	graph.on("cleared", scheduleTopology);
	graph.on("edgesCleared", scheduleTopology);
	return () => {
		disposed = true;
		pendingNodes.clear();
		graph.off("nodeAttributesUpdated", scheduleNode);
		graph.off("eachNodeAttributesUpdated", scheduleAllNodes);
		graph.off("nodeAdded", scheduleTopology);
		graph.off("nodeDropped", scheduleTopology);
		graph.off("edgeAdded", scheduleTopology);
		graph.off("edgeDropped", scheduleTopology);
		graph.off("edgeAttributesUpdated", scheduleTopology);
		graph.off("eachEdgeAttributesUpdated", scheduleTopology);
		graph.off("cleared", scheduleTopology);
		graph.off("edgesCleared", scheduleTopology);
	};
}
