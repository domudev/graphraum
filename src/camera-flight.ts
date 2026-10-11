import type { GraphraumFlyToOptions } from "./types";

export const FLY_TO_DEFAULT_DURATION_MS = 1200;

export interface ResolvedFlyToOptions {
	readonly distanceScale: number;
	readonly durationMs: number;
}

export function resolveFlyToOptions(options: GraphraumFlyToOptions): ResolvedFlyToOptions {
	const durationMs = options.durationMs ?? FLY_TO_DEFAULT_DURATION_MS;
	const distanceScale = options.distanceScale ?? 1;
	if (!Number.isFinite(durationMs) || durationMs < 0) {
		throw new Error(`flyTo durationMs must be a non-negative finite number of milliseconds; received ${durationMs}.`);
	}
	if (!Number.isFinite(distanceScale) || distanceScale <= 0) {
		throw new Error(`flyTo distanceScale must be a finite number above 0; received ${distanceScale}.`);
	}
	return { distanceScale, durationMs };
}

/** Cubic ease-in-out on `[0, 1]`: slow start, slow arrival, symmetric around 0.5. */
export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Linear progress of a flight, clamped to `[0, 1]`; a zero duration is already done. */
export function flightProgress(elapsedMs: number, durationMs: number): number {
	if (durationMs <= 0) return 1;
	return Math.min(Math.max(elapsedMs / durationMs, 0), 1);
}

/**
 * Interpolates a positive scale (camera distance, orthographic zoom) geometrically, so each
 * step zooms by the same factor and a long zoom does not rush its last part. Exact at both ends.
 */
export function interpolateScale(from: number, to: number, t: number): number {
	if (t <= 0) return from;
	if (t >= 1) return to;
	return from * (to / from) ** t;
}
