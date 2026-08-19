import type { GraphraumEdgePath, GraphraumPosition } from "./types";

export type EdgeLodTier = "overview" | "detail";

/** Worst-case detail segment count (cubic). Used for GPU buffer capacity. */
export const DETAIL_MAX_SEGMENTS = 24;

const AUTO_OFFSET_FRACTION = 0.18;

export function segmentCountForPath(path: GraphraumEdgePath | undefined, tier: EdgeLodTier): number {
	if (tier === "overview") return 1;
	const resolved = path ?? "straight";
	if (resolved === "quadratic") return 16;
	if (resolved === "cubic") return 24;
	return 1;
}

export function autoControlPoints(
	path: GraphraumEdgePath,
	x1: number,
	y1: number,
	z1: number,
	x2: number,
	y2: number,
	z2: number,
): GraphraumPosition[] {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const length = Math.hypot(dx, dy);
	const offset = length * AUTO_OFFSET_FRACTION;
	const nx = length > 0 ? -dy / length : 0;
	const ny = length > 0 ? dx / length : 1;
	if (path === "quadratic") {
		return [
			{
				x: (x1 + x2) / 2 + nx * offset,
				y: (y1 + y2) / 2 + ny * offset,
				z: (z1 + z2) / 2,
			},
		];
	}
	if (path === "cubic") {
		return [
			{
				x: x1 + dx / 3 + nx * offset,
				y: y1 + dy / 3 + ny * offset,
				z: z1 + (z2 - z1) / 3,
			},
			{
				x: x1 + (dx * 2) / 3 - nx * offset,
				y: y1 + (dy * 2) / 3 - ny * offset,
				z: z1 + ((z2 - z1) * 2) / 3,
			},
		];
	}
	return [];
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function sampleQuadratic(
	x1: number,
	y1: number,
	z1: number,
	cx: number,
	cy: number,
	cz: number,
	x2: number,
	y2: number,
	z2: number,
	t: number,
): GraphraumPosition {
	const u = 1 - t;
	return {
		x: u * u * x1 + 2 * u * t * cx + t * t * x2,
		y: u * u * y1 + 2 * u * t * cy + t * t * y2,
		z: u * u * z1 + 2 * u * t * cz + t * t * z2,
	};
}

function sampleCubic(
	x1: number,
	y1: number,
	z1: number,
	c1x: number,
	c1y: number,
	c1z: number,
	c2x: number,
	c2y: number,
	c2z: number,
	x2: number,
	y2: number,
	z2: number,
	t: number,
): GraphraumPosition {
	const u = 1 - t;
	return {
		x: u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2,
		y: u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2,
		z: u * u * u * z1 + 3 * u * u * t * c1z + 3 * u * t * t * c2z + t * t * t * z2,
	};
}

export function resolveControlPoints(
	path: GraphraumEdgePath,
	controlPoints: readonly GraphraumPosition[] | undefined,
	x1: number,
	y1: number,
	z1: number,
	x2: number,
	y2: number,
	z2: number,
): readonly GraphraumPosition[] {
	if (path === "straight") return [];
	if (controlPoints && controlPoints.length > 0) return controlPoints;
	return autoControlPoints(path, x1, y1, z1, x2, y2, z2);
}

export function sampleEdgePath(input: {
	path: GraphraumEdgePath | undefined;
	controlPoints: readonly GraphraumPosition[] | undefined;
	tier: EdgeLodTier;
	x1: number;
	y1: number;
	z1: number;
	x2: number;
	y2: number;
	z2: number;
}): GraphraumPosition[] {
	const path = input.tier === "overview" ? "straight" : (input.path ?? "straight");
	const segments = segmentCountForPath(path, input.tier);
	if (path === "straight" || segments <= 1) {
		return [
			{ x: input.x1, y: input.y1, z: input.z1 },
			{ x: input.x2, y: input.y2, z: input.z2 },
		];
	}
	const controls = resolveControlPoints(
		path,
		input.controlPoints,
		input.x1,
		input.y1,
		input.z1,
		input.x2,
		input.y2,
		input.z2,
	);
	const points: GraphraumPosition[] = [];
	for (let index = 0; index <= segments; index += 1) {
		const t = index / segments;
		if (path === "quadratic") {
			const control = controls[0] ?? {
				x: lerp(input.x1, input.x2, 0.5),
				y: lerp(input.y1, input.y2, 0.5),
				z: lerp(input.z1, input.z2, 0.5),
			};
			points.push(
				sampleQuadratic(
					input.x1,
					input.y1,
					input.z1,
					control.x,
					control.y,
					control.z ?? 0,
					input.x2,
					input.y2,
					input.z2,
					t,
				),
			);
		} else {
			const c1 = controls[0] ?? {
				x: lerp(input.x1, input.x2, 1 / 3),
				y: lerp(input.y1, input.y2, 1 / 3),
				z: lerp(input.z1, input.z2, 1 / 3),
			};
			const c2 = controls[1] ?? {
				x: lerp(input.x1, input.x2, 2 / 3),
				y: lerp(input.y1, input.y2, 2 / 3),
				z: lerp(input.z1, input.z2, 2 / 3),
			};
			points.push(
				sampleCubic(
					input.x1,
					input.y1,
					input.z1,
					c1.x,
					c1.y,
					c1.z ?? 0,
					c2.x,
					c2.y,
					c2.z ?? 0,
					input.x2,
					input.y2,
					input.z2,
					t,
				),
			);
		}
	}
	return points;
}
