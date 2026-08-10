/** A straight world-space segment that can be hit-tested for edge picking. */
export interface PickableEdgeSegment {
	edgeIndex: number;
	hitSlop: number;
	x1: number;
	x2: number;
	y1: number;
	y2: number;
}

/** Squared distance from a point to the closest point on a finite segment. */
export function distanceSquaredToSegment2d(
	px: number,
	py: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) {
		const ox = px - x1;
		const oy = py - y1;
		return ox * ox + oy * oy;
	}
	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
	const closestX = x1 + t * dx;
	const closestY = y1 + t * dy;
	const ox = px - closestX;
	const oy = py - closestY;
	return ox * ox + oy * oy;
}

/**
 * Returns the edge index of the closest segment within its hit slop, or null.
 * When several edges qualify, the nearest wins; ties keep the first encountered edge index.
 */
export function pickClosestEdgeIndex(
	point: { x: number; y: number },
	segments: readonly PickableEdgeSegment[],
): number | null {
	let nearestEdgeIndex: number | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const segment of segments) {
		const distanceSquared = distanceSquaredToSegment2d(
			point.x,
			point.y,
			segment.x1,
			segment.y1,
			segment.x2,
			segment.y2,
		);
		const slop = segment.hitSlop;
		if (distanceSquared > slop * slop) continue;
		if (distanceSquared < nearestDistance) {
			nearestDistance = distanceSquared;
			nearestEdgeIndex = segment.edgeIndex;
		}
	}
	return nearestEdgeIndex;
}
