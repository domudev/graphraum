/**
 * Exact perspective fit for the 3D front view (camera on +z looking down -z, y up).
 *
 * Nodes are view-aligned billboards with half extents `halfWidth`/`halfHeight` at their centre
 * depth, so a node fits when `|x - targetX| + halfWidth <= tanX * depth` and likewise for y, where
 * `depth = cameraZ - z` and `tanX = tan(fov / 2) * aspect * fill`. Each bound is linear in the
 * camera position, so one pass gives the closest camera and the centre at which the tighter axis
 * touches the margin on both sides. A few more passes centre the other axis on screen.
 */

export interface PerspectiveFitFrame {
	/** Canvas width / height. */
	aspect: number;
	/** Fraction of the canvas the graph may span on its tighter axis, in (0, 1]. */
	fill: number;
	/** Vertical field of view in degrees. */
	fovDegrees: number;
}

export interface FitNode {
	/** Positive half extents of the node billboard. */
	halfHeight: number;
	halfWidth: number;
	x: number;
	y: number;
	z: number;
}

/** Re-readable node source: `read` fills `out` so a fit allocates nothing per node. */
export interface FitNodes {
	readonly count: number;
	read(index: number, out: FitNode): void;
}

export interface PerspectiveFit {
	/** Camera z; the camera sits at `(target.x, target.y, cameraZ)` looking down -z. */
	cameraZ: number;
	far: number;
	near: number;
	/** Orbit pivot: the fitted screen centre at the middle of the graph's depth. */
	target: { x: number; y: number; z: number };
}

/** Newton steps on a piecewise-linear function; real graphs settle in two to four. */
const MAX_CENTERING_STEPS = 32;

/** The closest front-view camera that frames every node, or `null` without nodes. */
export function fitPerspective(frame: PerspectiveFitFrame, nodes: FitNodes): PerspectiveFit | null {
	if (nodes.count === 0) return null;
	const tanY = Math.tan((frame.fovDegrees * Math.PI) / 360) * frame.fill;
	const tanX = tanY * frame.aspect;
	const node: FitNode = { halfHeight: 0, halfWidth: 0, x: 0, y: 0, z: 0 };
	let right = Number.NEGATIVE_INFINITY;
	let left = Number.NEGATIVE_INFINITY;
	let top = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (let index = 0; index < nodes.count; index += 1) {
		nodes.read(index, node);
		right = Math.max(right, node.x + node.halfWidth + tanX * node.z);
		left = Math.max(left, -node.x + node.halfWidth + tanX * node.z);
		top = Math.max(top, node.y + node.halfHeight + tanY * node.z);
		bottom = Math.max(bottom, -node.y + node.halfHeight + tanY * node.z);
		minZ = Math.min(minZ, node.z);
		maxZ = Math.max(maxZ, node.z);
	}

	const cameraZX = (right + left) / (2 * tanX);
	const cameraZY = (top + bottom) / (2 * tanY);
	const cameraZ = Math.max(cameraZX, cameraZY);
	// Both sides of the tighter axis touch the margin at `cameraZ`, so its centre is unique.
	let x = (right - left) / 2;
	let y = (top - bottom) / 2;
	if (cameraZX < cameraZY) x = centerOnScreen(nodes, node, "x", cameraZ, x);
	else if (cameraZY < cameraZX) y = centerOnScreen(nodes, node, "y", cameraZ, y);

	const target = { x, y, z: (minZ + maxZ) / 2 };
	const distance = cameraZ - target.z;
	const nearestDepth = cameraZ - maxZ;
	return {
		cameraZ,
		// Every node is at least `halfExtent / tan` in front of the camera; keep near inside that.
		near: Math.min(Math.max(distance / 10_000, 0.1), nearestDepth / 2),
		// The farthest node is under `2 * distance` away; the slack leaves room to zoom out.
		far: distance * 10,
		target,
	};
}

/**
 * Centre on the looser axis that makes the farthest screen reach equal on both sides.
 *
 * With depth `d = cameraZ - z`, a centre `c` keeps every node within screen reach `r` when
 * `max(p + h - r * d) <= c <= min(p - h + r * d)`. The gap between those bounds is convex and
 * decreasing in `r`, so Newton steps from `r = 0` rise monotonically to the smallest feasible
 * reach. `planeCenter` already fits, so it is the answer if the steps do not settle.
 */
function centerOnScreen(nodes: FitNodes, node: FitNode, axis: "x" | "y", cameraZ: number, planeCenter: number): number {
	let reach = 0;
	for (let step = 0; step < MAX_CENTERING_STEPS; step += 1) {
		let low = Number.NEGATIVE_INFINITY;
		let high = Number.POSITIVE_INFINITY;
		let lowValue = 0;
		let lowDepth = 0;
		let highValue = 0;
		let highDepth = 0;
		for (let index = 0; index < nodes.count; index += 1) {
			nodes.read(index, node);
			const position = axis === "x" ? node.x : node.y;
			const half = axis === "x" ? node.halfWidth : node.halfHeight;
			const depth = cameraZ - node.z;
			const lowBound = position + half - reach * depth;
			const highBound = position - half + reach * depth;
			if (lowBound > low) {
				low = lowBound;
				lowValue = position + half;
				lowDepth = depth;
			}
			if (highBound < high) {
				high = highBound;
				highValue = position - half;
				highDepth = depth;
			}
		}
		if (low <= high) return (low + high) / 2;
		const next = (lowValue - highValue) / (lowDepth + highDepth);
		if (next <= reach) return (low + high) / 2;
		reach = next;
	}
	return planeCenter;
}
