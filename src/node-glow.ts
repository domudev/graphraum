/** Hard cap on halo instances per frame; the highest glow wins, ties go to the lower node index. */
export const GLOW_MAX_INSTANCES = 256;

/** Halo radius as a multiple of the node's half-extent at `glow: 1`. */
export const GLOW_RADIUS_SCALE = 3.4;

/** Reusable selection buffer: `indices[0..count)` holds node indices ordered by glow. */
export interface GlowSelection {
	count: number;
	indices: Uint32Array;
}

export function assertNodeGlow(nodeId: string, glow: number | undefined): void {
	if (glow !== undefined && (!Number.isFinite(glow) || glow < 0 || glow > 1)) {
		throw new Error(`Node "${nodeId}" glow must be a finite number between 0 and 1`);
	}
}

/**
 * Halo radius in world units: `extent × (1 + (GLOW_RADIUS_SCALE − 1) × glow)`, where `extent` is
 * the node's half-extent `max(width, height)`. Glow 0 collapses the halo under the node; glow 1
 * reaches 3.4× the node extent.
 */
export function glowHaloRadius(extent: number, glow: number): number {
	return extent * (1 + (GLOW_RADIUS_SCALE - 1) * glow);
}

/** Peak halo opacity at the node center; the shader fades it radially to 0 at the halo radius. */
export function glowHaloOpacity(glow: number): number {
	return glow;
}

/** Keeps `current` while it fits, otherwise grows to the next power of two capped at `maximum`. */
export function glowBufferCapacity(required: number, current: number, maximum: number): number {
	if (required <= current) return current;
	let capacity = Math.max(current, 1);
	while (capacity < required) capacity *= 2;
	return Math.min(capacity, maximum);
}

export function createGlowSelection(): GlowSelection {
	return { count: 0, indices: new Uint32Array(0) };
}

/**
 * Selects visible nodes with `glow > 0` into `selection`, highest glow first and ties by node
 * index, capped at {@link GLOW_MAX_INSTANCES}. Selects nothing in the density LOD tier. Reuses
 * the selection buffer and grows it geometrically; allocates no per-node objects.
 */
export function selectGlowNodes(
	visibleNodeIndices: readonly number[],
	glowAt: (nodeIndex: number) => number,
	densityLod: boolean,
	selection: GlowSelection,
): GlowSelection {
	selection.count = 0;
	if (densityLod) return selection;
	let candidates = 0;
	for (const nodeIndex of visibleNodeIndices) {
		if (!(glowAt(nodeIndex) > 0)) continue;
		if (candidates === selection.indices.length) {
			const grown = new Uint32Array(glowBufferCapacity(candidates + 1, candidates, Number.POSITIVE_INFINITY));
			grown.set(selection.indices);
			selection.indices = grown;
		}
		selection.indices[candidates] = nodeIndex;
		candidates += 1;
	}
	selection.indices.subarray(0, candidates).sort((a, b) => glowAt(b) - glowAt(a) || a - b);
	selection.count = Math.min(candidates, GLOW_MAX_INSTANCES);
	return selection;
}
