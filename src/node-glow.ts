import { Color } from "three";

import { normalizeGraphraumBackground } from "./theme";
import type { GraphraumBackground } from "./types";

/** Hard cap on halo instances per frame; the highest glow wins, ties go to the lower node index. */
export const GLOW_MAX_INSTANCES = 256;

/** Halo radius as a multiple of the node's half-extent at `glow: 1`. */
export const GLOW_RADIUS_SCALE = 3.4;

/** Solid backgrounds at or above this relative luminance switch halos from additive to normal blending. */
export const GLOW_LIGHT_BACKGROUND_LUMINANCE = 0.5;

/** Halo opacity multiplier under normal blending, so a light background shows a soft tint. */
export const GLOW_NORMAL_OPACITY_SCALE = 0.6;

export type GlowBlendMode = "additive" | "normal";

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

/**
 * Additive light reads on dark backgrounds but saturates to nothing on light ones. A solid
 * background whose relative luminance (linear sRGB, 0.2126 R + 0.7152 G + 0.0722 B) reaches
 * {@link GLOW_LIGHT_BACKGROUND_LUMINANCE} uses normal blending; transparent and pattern
 * backgrounds keep additive blending because their brightness is unknown.
 */
export function glowBlendModeFor(background: GraphraumBackground): GlowBlendMode {
	const normalized = normalizeGraphraumBackground(background);
	if (normalized === null || typeof normalized === "object") return "additive";
	const { b, g, r } = new Color(normalized);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b >= GLOW_LIGHT_BACKGROUND_LUMINANCE ? "normal" : "additive";
}

export function glowOpacityScale(mode: GlowBlendMode): number {
	return mode === "normal" ? GLOW_NORMAL_OPACITY_SCALE : 1;
}
