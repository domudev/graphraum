import type { Graphraum } from "../../../src/graphraum";

type Topology = {
	edges: readonly { id: string; source: string; target: string }[];
	nodes: readonly { id: string }[];
};

/** Edge IDs that touch `nodeId`. */
export function incidentEdgeIds(data: Topology, nodeId: string): string[] {
	return data.edges.filter(({ source, target }) => source === nodeId || target === nodeId).map(({ id }) => id);
}

/** IDs outside the node's one-hop neighborhood, for dimming. */
export function outsideNeighborhood(data: Topology, nodeId: string): { edgeIds: string[]; nodeIds: string[] } {
	const neighborhood = new Set([nodeId]);
	const incident = new Set<string>();
	for (const edge of data.edges) {
		if (edge.source !== nodeId && edge.target !== nodeId) continue;
		incident.add(edge.id);
		neighborhood.add(edge.source);
		neighborhood.add(edge.target);
	}
	return {
		edgeIds: data.edges.filter(({ id }) => !incident.has(id)).map(({ id }) => id),
		nodeIds: data.nodes.filter(({ id }) => !neighborhood.has(id)).map(({ id }) => id),
	};
}

/** Selects a node, highlights its edges, and dims everything else. `null` clears the focus. */
export function focusNode<NodeAttributes, EdgeAttributes>(
	graph: Graphraum<NodeAttributes, EdgeAttributes>,
	data: Topology,
	nodeId: string | null,
): void {
	graph.setSelection(nodeId ? [nodeId] : []);
	if (!nodeId) {
		graph.setNodeState("dimmed", []);
		graph.setEdgeState("dimmed", []);
		graph.setEdgeSelection([]);
		return;
	}
	const outside = outsideNeighborhood(data, nodeId);
	graph.setNodeState("dimmed", outside.nodeIds);
	graph.setEdgeState("dimmed", outside.edgeIds);
	graph.setEdgeSelection(incidentEdgeIds(data, nodeId));
}
