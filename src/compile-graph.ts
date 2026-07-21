import type { GraphraumData } from "./types";

export interface CompiledGraph {
	edgeNodeIndices: Uint32Array;
	edgePositions: Float32Array;
	incidentEdgeIndices: readonly (readonly number[])[];
	nodeIds: readonly string[];
	nodeIndices: ReadonlyMap<string, number>;
	nodePositions: Float32Array;
}

function assertFinitePosition(nodeId: string, axis: string, value: number) {
	if (!Number.isFinite(value)) throw new Error(`Node "${nodeId}" has a non-finite ${axis} position`);
}

/** Validates graph identity and compiles lookup-heavy objects into GPU-oriented position buffers. */
export function compileGraph(data: GraphraumData): CompiledGraph {
	const nodeIndices = new Map<string, number>();
	const nodePositions = new Float32Array(data.nodes.length * 3);

	for (const [index, node] of data.nodes.entries()) {
		if (nodeIndices.has(node.id)) throw new Error(`Duplicate node id: "${node.id}"`);
		assertFinitePosition(node.id, "x", node.position.x);
		assertFinitePosition(node.id, "y", node.position.y);
		assertFinitePosition(node.id, "z", node.position.z ?? 0);
		if (node.size !== undefined && (!Number.isFinite(node.size) || node.size <= 0)) {
			throw new Error(`Node "${node.id}" must have a positive finite size`);
		}

		nodeIndices.set(node.id, index);
		nodePositions.set([node.position.x, node.position.y, node.position.z ?? 0], index * 3);
	}

	const edgeIds = new Set<string>();
	const edgeNodeIndices = new Uint32Array(data.edges.length * 2);
	const edgePositions = new Float32Array(data.edges.length * 6);
	const incidentEdgeIndices = Array.from({ length: data.nodes.length }, () => [] as number[]);
	for (const [index, edge] of data.edges.entries()) {
		if (edgeIds.has(edge.id)) throw new Error(`Duplicate edge id: "${edge.id}"`);
		edgeIds.add(edge.id);

		const sourceIndex = nodeIndices.get(edge.source);
		const targetIndex = nodeIndices.get(edge.target);
		if (sourceIndex === undefined) throw new Error(`Edge "${edge.id}" references missing source "${edge.source}"`);
		if (targetIndex === undefined) throw new Error(`Edge "${edge.id}" references missing target "${edge.target}"`);
		edgeNodeIndices.set([sourceIndex, targetIndex], index * 2);
		incidentEdgeIndices[sourceIndex]?.push(index);
		if (targetIndex !== sourceIndex) incidentEdgeIndices[targetIndex]?.push(index);

		edgePositions.set(nodePositions.subarray(sourceIndex * 3, sourceIndex * 3 + 3), index * 6);
		edgePositions.set(nodePositions.subarray(targetIndex * 3, targetIndex * 3 + 3), index * 6 + 3);
	}

	return {
		edgeNodeIndices,
		edgePositions,
		incidentEdgeIndices,
		nodeIds: data.nodes.map((node) => node.id),
		nodeIndices,
		nodePositions,
	};
}
