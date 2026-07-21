/** Collects unique edges touching visible nodes without scanning the complete edge list. */
export function collectIncidentEdges(
	visibleNodeIndices: readonly number[],
	incidentEdgeIndices: readonly (readonly number[])[],
): readonly number[] {
	const edges = new Set<number>();
	for (const nodeIndex of visibleNodeIndices) {
		for (const edgeIndex of incidentEdgeIndices[nodeIndex] ?? []) edges.add(edgeIndex);
	}
	return [...edges];
}

/** Applies a deterministic, evenly distributed overview budget. */
export function applyEdgeBudget(edgeIndices: readonly number[], maximum: number): readonly number[] {
	if (!Number.isSafeInteger(maximum) || maximum < 1)
		throw new Error("Maximum visible edges must be a positive integer.");
	if (edgeIndices.length <= maximum) return edgeIndices;
	const step = edgeIndices.length / maximum;
	return Array.from({ length: maximum }, (_, index) => edgeIndices[Math.floor(index * step)]).filter(
		(edgeIndex): edgeIndex is number => edgeIndex !== undefined,
	);
}
