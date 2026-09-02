import { resolveNodeAxes } from "./node-axes";
import { containsNodePoint } from "./node-shapes";
import type { GraphraumNodeShape, GraphraumPosition } from "./types";

export type EndpointAttach = "boundary" | "center";

export const DEFAULT_ENDPOINT_ATTACH: EndpointAttach = "boundary";
export const DEFAULT_ENDPOINT_CLEARANCE = 0.75;

export interface EndpointOutline {
	height?: number;
	shape?: GraphraumNodeShape;
	size?: number;
	strokeWidth?: number;
	width?: number;
}

export interface TrimEdgeEndpointsInput {
	attach?: EndpointAttach;
	clearance?: number;
	source: GraphraumPosition;
	sourceOutline: EndpointOutline;
	target: GraphraumPosition;
	targetOutline: EndpointOutline;
}

function isInsideOutline(outline: EndpointOutline, worldX: number, worldY: number, center: GraphraumPosition): boolean {
	const { height, width } = resolveNodeAxes({
		height: outline.height,
		size: outline.size,
		width: outline.width,
	});
	const stroke = Math.max(0, outline.strokeWidth ?? 0);
	const halfWidth = width + stroke;
	const halfHeight = height + stroke;
	if (halfWidth <= 0 || halfHeight <= 0) return false;
	return containsNodePoint(outline.shape, (worldX - center.x) / halfWidth, (worldY - center.y) / halfHeight);
}

/**
 * Walk from the node center toward the far point and stop on the outline,
 * then pull back by `clearance` so the stroke is not stabbed.
 */
export function attachPointOnOutline(
	center: GraphraumPosition,
	far: GraphraumPosition,
	outline: EndpointOutline,
	clearance = DEFAULT_ENDPOINT_CLEARANCE,
): GraphraumPosition {
	const dx = far.x - center.x;
	const dy = far.y - center.y;
	const dz = (far.z ?? 0) - (center.z ?? 0);
	const length = Math.hypot(dx, dy, dz);
	if (length < 1e-6) return { x: center.x, y: center.y, z: center.z ?? 0 };

	let low = 0;
	let high = 1;
	for (let step = 0; step < 24; step += 1) {
		const mid = (low + high) / 2;
		const x = center.x + dx * mid;
		const y = center.y + dy * mid;
		if (isInsideOutline(outline, x, y, center)) low = mid;
		else high = mid;
	}

	const clearanceT = Math.min(Math.max(clearance, 0) / length, 0.45);
	const t = Math.max(0, low - clearanceT);
	return {
		x: center.x + dx * t,
		y: center.y + dy * t,
		z: (center.z ?? 0) + dz * t,
	};
}

/** Trim both ends of a center-to-center chord (or curve endpoints) to node boundaries. */
export function trimEdgeEndpoints(input: TrimEdgeEndpointsInput): {
	source: GraphraumPosition;
	target: GraphraumPosition;
} {
	if ((input.attach ?? DEFAULT_ENDPOINT_ATTACH) === "center") {
		return {
			source: { x: input.source.x, y: input.source.y, z: input.source.z ?? 0 },
			target: { x: input.target.x, y: input.target.y, z: input.target.z ?? 0 },
		};
	}
	const clearance = input.clearance ?? DEFAULT_ENDPOINT_CLEARANCE;
	const source = attachPointOnOutline(input.source, input.target, input.sourceOutline, clearance);
	const target = attachPointOnOutline(input.target, input.source, input.targetOutline, clearance);
	const ox = input.target.x - input.source.x;
	const oy = input.target.y - input.source.y;
	const oz = (input.target.z ?? 0) - (input.source.z ?? 0);
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const dz = (target.z ?? 0) - (source.z ?? 0);
	// Collapsed or crossed after trim (overlapping nodes) — fall back to centers.
	if (dx * ox + dy * oy + dz * oz <= 1e-8) {
		return {
			source: { x: input.source.x, y: input.source.y, z: input.source.z ?? 0 },
			target: { x: input.target.x, y: input.target.y, z: input.target.z ?? 0 },
		};
	}
	return { source, target };
}
