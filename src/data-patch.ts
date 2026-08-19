import type { GraphraumDataPatch, GraphraumEdge, GraphraumNode } from "./types";

export interface MergedGraphData<NodeAttributes = undefined, EdgeAttributes = undefined> {
	edges: GraphraumEdge<EdgeAttributes>[];
	nodes: GraphraumNode<NodeAttributes>[];
}

/** Merge additions and removals into a dense graph snapshot. Cascades edges whose endpoints vanish. */
export function mergeDataPatch<NodeAttributes = undefined, EdgeAttributes = undefined>(
	currentNodes: readonly GraphraumNode<NodeAttributes>[],
	currentEdges: readonly GraphraumEdge<EdgeAttributes>[],
	patch: GraphraumDataPatch<NodeAttributes, EdgeAttributes>,
): MergedGraphData<NodeAttributes, EdgeAttributes> {
	const removedNodes = new Set(patch.removedNodeIds ?? []);
	const removedEdges = new Set(patch.removedEdgeIds ?? []);
	const nodes = new Map(currentNodes.map((node) => [node.id, node]));
	const edges = new Map(currentEdges.map((edge) => [edge.id, edge]));

	for (const id of removedNodes) nodes.delete(id);
	for (const id of removedEdges) edges.delete(id);
	for (const node of patch.addedNodes ?? []) nodes.set(node.id, node);
	for (const edge of patch.addedEdges ?? []) edges.set(edge.id, edge);

	return {
		nodes: [...nodes.values()],
		edges: [...edges.values()].filter((edge) => nodes.has(edge.source) && nodes.has(edge.target)),
	};
}

/** True when the merged live graph fits the already-allocated mesh capacities. */
export function dataPatchFitsCapacity(
	merged: { edges: readonly unknown[]; nodes: readonly unknown[] },
	capacity: { edges: number; nodes: number },
): boolean {
	return merged.nodes.length <= capacity.nodes && merged.edges.length <= capacity.edges;
}

/** True when the patch is add-only and can grow dense arrays without rewriting survivors. */
export function isAppendOnlyDataPatch<NodeAttributes = undefined, EdgeAttributes = undefined>(
	patch: GraphraumDataPatch<NodeAttributes, EdgeAttributes>,
): boolean {
	return (patch.removedNodeIds?.length ?? 0) === 0 && (patch.removedEdgeIds?.length ?? 0) === 0;
}
