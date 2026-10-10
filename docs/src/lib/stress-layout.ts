/** Mean distance of a node to its cluster centroid, as a share of the mean nearest-centroid distance. */
export const CLUSTER_SPREAD_RATIO = 0.3;
const MAX_SPREAD = 6;

function centroids(positions: Float32Array, clusters: Uint32Array, clusterCount: number) {
	const sums = new Float64Array(clusterCount * 3);
	const counts = new Float64Array(clusterCount);
	for (const [index, cluster] of clusters.entries()) {
		for (let axis = 0; axis < 3; axis += 1) sums[cluster * 3 + axis] += positions[index * 3 + axis] ?? 0;
		counts[cluster] += 1;
	}
	for (let cluster = 0; cluster < clusterCount; cluster += 1) {
		for (let axis = 0; axis < 3; axis += 1) sums[cluster * 3 + axis] /= Math.max(1, counts[cluster] ?? 1);
	}
	return sums;
}

/** Mean spread of the clusters relative to their spacing (0 when there is only one cluster). */
export function clusterSpreadRatio(positions: Float32Array, clusters: Uint32Array) {
	const clusterCount = clusters.reduce((max, cluster) => Math.max(max, cluster + 1), 0);
	if (clusterCount < 2) return 0;
	const center = centroids(positions, clusters, clusterCount);
	/** Distance from point `index` of `from` to the centroid of `cluster`. */
	const distance = (from: Float32Array | Float64Array, index: number, cluster: number) =>
		Math.hypot(
			(from[index * 3] ?? 0) - (center[cluster * 3] ?? 0),
			(from[index * 3 + 1] ?? 0) - (center[cluster * 3 + 1] ?? 0),
			(from[index * 3 + 2] ?? 0) - (center[cluster * 3 + 2] ?? 0),
		);
	let radius = 0;
	for (const [index, cluster] of clusters.entries()) radius += distance(positions, index, cluster);
	radius /= clusters.length;
	let spacing = 0;
	for (let cluster = 0; cluster < clusterCount; cluster += 1) {
		let nearest = Number.POSITIVE_INFINITY;
		for (let other = 0; other < clusterCount; other += 1) {
			if (other !== cluster) nearest = Math.min(nearest, distance(center, cluster, other));
		}
		spacing += nearest;
	}
	spacing /= clusterCount;
	return spacing > 0 ? radius / spacing : 0;
}

/**
 * Scales every node's offset from its cluster centroid so clusters fill about
 * {@link CLUSTER_SPREAD_RATIO} of the gap to the nearest cluster. graphraum's clustered force seeding
 * keeps clusters tight and far apart at small sizes, which reads as dots at 1,000 nodes.
 * Mutates and returns `positions`; never shrinks a cluster and caps growth at 6x.
 */
export function spreadClusters(positions: Float32Array, clusters: Uint32Array, target = CLUSTER_SPREAD_RATIO) {
	const ratio = clusterSpreadRatio(positions, clusters);
	if (ratio <= 0 || ratio >= target) return positions;
	const factor = Math.min(MAX_SPREAD, target / ratio);
	const clusterCount = clusters.reduce((max, cluster) => Math.max(max, cluster + 1), 0);
	const center = centroids(positions, clusters, clusterCount);
	for (const [index, cluster] of clusters.entries()) {
		for (let axis = 0; axis < 3; axis += 1) {
			const c = center[cluster * 3 + axis] ?? 0;
			positions[index * 3 + axis] = c + ((positions[index * 3 + axis] ?? 0) - c) * factor;
		}
	}
	return positions;
}

/** World units per node across the stress layout, the same density as the 12-unit grid fallback. */
export const STRESS_UNITS_PER_NODE = 24;

/**
 * Scales positions about their centre so the larger side spans `sqrt(nodeCount) * STRESS_UNITS_PER_NODE`.
 * Node sizes are in world units, so this keeps nodes visible after {@link spreadClusters} widens the layout.
 */
export function normalizeExtent(positions: Float32Array, nodeCount: number) {
	const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for (let index = 0; index < positions.length; index += 3) {
		for (let axis = 0; axis < 3; axis += 1) {
			const value = positions[index + axis] ?? 0;
			min[axis] = Math.min(min[axis] ?? value, value);
			max[axis] = Math.max(max[axis] ?? value, value);
		}
	}
	const span = Math.max((max[0] ?? 0) - (min[0] ?? 0), (max[1] ?? 0) - (min[1] ?? 0));
	if (!(span > 0)) return positions;
	const scale = (Math.sqrt(nodeCount) * STRESS_UNITS_PER_NODE) / span;
	for (let index = 0; index < positions.length; index += 3) {
		for (let axis = 0; axis < 3; axis += 1) {
			const centre = ((min[axis] ?? 0) + (max[axis] ?? 0)) / 2;
			positions[index + axis] = centre + ((positions[index + axis] ?? 0) - centre) * scale;
		}
	}
	return positions;
}
