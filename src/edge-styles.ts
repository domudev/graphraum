import type {
	GraphraumEdgeMarker,
	GraphraumEdgeMarkerEnd,
	GraphraumEdgePath,
	GraphraumEdgeStyle,
	GraphraumEdgeVisual,
	GraphraumPosition,
} from "./types";

export const graphraumEdgeStyles = ["solid", "dashed", "dotted"] as const satisfies readonly GraphraumEdgeStyle[];
export const graphraumEdgeMarkers = ["none", "triangle"] as const satisfies readonly GraphraumEdgeMarker[];
export const graphraumEdgeMarkerEnds = [
	"target",
	"source",
	"both",
] as const satisfies readonly GraphraumEdgeMarkerEnd[];
export const graphraumEdgePaths = ["straight", "quadratic", "cubic"] as const satisfies readonly GraphraumEdgePath[];

const styleCodes: Readonly<Record<GraphraumEdgeStyle, number>> = { solid: 0, dashed: 1, dotted: 2 };
const markerCodes: Readonly<Record<GraphraumEdgeMarker, number>> = { none: 0, triangle: 1 };

export function assertEdgeStyle(edgeId: string, style: unknown): asserts style is GraphraumEdgeStyle {
	if (typeof style !== "string" || !graphraumEdgeStyles.includes(style as GraphraumEdgeStyle)) {
		throw new Error(`Edge "${edgeId}" style must be one of: ${graphraumEdgeStyles.map((s) => `"${s}"`).join(", ")}`);
	}
}

export function assertEdgeMarker(edgeId: string, marker: unknown): asserts marker is GraphraumEdgeMarker {
	if (typeof marker !== "string" || !graphraumEdgeMarkers.includes(marker as GraphraumEdgeMarker)) {
		throw new Error(`Edge "${edgeId}" marker must be one of: ${graphraumEdgeMarkers.map((m) => `"${m}"`).join(", ")}`);
	}
}

export function assertEdgeMarkerEnd(edgeId: string, markerEnd: unknown): asserts markerEnd is GraphraumEdgeMarkerEnd {
	if (typeof markerEnd !== "string" || !graphraumEdgeMarkerEnds.includes(markerEnd as GraphraumEdgeMarkerEnd)) {
		throw new Error(
			`Edge "${edgeId}" markerEnd must be one of: ${graphraumEdgeMarkerEnds.map((m) => `"${m}"`).join(", ")}`,
		);
	}
}

export function assertEdgePath(edgeId: string, path: unknown): asserts path is GraphraumEdgePath {
	if (typeof path !== "string" || !graphraumEdgePaths.includes(path as GraphraumEdgePath)) {
		throw new Error(`Edge "${edgeId}" path must be one of: ${graphraumEdgePaths.map((p) => `"${p}"`).join(", ")}`);
	}
}

function assertControlPoint(edgeId: string, index: number, point: GraphraumPosition) {
	if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || (point.z !== undefined && !Number.isFinite(point.z))) {
		throw new Error(`Edge "${edgeId}" controlPoints[${index}] must have finite coordinates`);
	}
}

export function assertEdgeControlPoints(
	edgeId: string,
	path: GraphraumEdgePath | undefined,
	controlPoints: readonly GraphraumPosition[] | undefined,
): void {
	if (controlPoints === undefined) return;
	for (const [index, point] of controlPoints.entries()) assertControlPoint(edgeId, index, point);
	const resolvedPath = path ?? "straight";
	if (resolvedPath === "straight") return;
	if (controlPoints.length === 0) return;
	const expected = resolvedPath === "quadratic" ? 1 : 2;
	if (controlPoints.length !== expected) {
		throw new Error(
			`Edge "${edgeId}" path "${resolvedPath}" expects ${expected} control point${expected === 1 ? "" : "s"} or none for auto defaults (got ${controlPoints.length})`,
		);
	}
}

export function assertEdgeVisual(edgeId: string, visual: GraphraumEdgeVisual): void {
	if (visual.width !== undefined && (!Number.isFinite(visual.width) || visual.width <= 0)) {
		throw new Error(`Edge "${edgeId}" visual must have a positive finite width`);
	}
	if (visual.opacity !== undefined && (!Number.isFinite(visual.opacity) || visual.opacity < 0 || visual.opacity > 1)) {
		throw new Error(`Edge "${edgeId}" visual opacity must be a finite number between 0 and 1`);
	}
	if (visual.markerSize !== undefined && (!Number.isFinite(visual.markerSize) || visual.markerSize <= 0)) {
		throw new Error(`Edge "${edgeId}" visual must have a positive finite markerSize`);
	}
	if (visual.style !== undefined) assertEdgeStyle(edgeId, visual.style);
	if (visual.marker !== undefined) assertEdgeMarker(edgeId, visual.marker);
	if (visual.markerEnd !== undefined) assertEdgeMarkerEnd(edgeId, visual.markerEnd);
	if (visual.path !== undefined) assertEdgePath(edgeId, visual.path);
	assertEdgeControlPoints(edgeId, visual.path, visual.controlPoints);
}

export function encodeEdgeStyle(style: GraphraumEdgeStyle | undefined): number {
	return styleCodes[style ?? "solid"];
}

export function encodeEdgeMarker(marker: GraphraumEdgeMarker | undefined): number {
	return markerCodes[marker ?? "none"];
}

export function markerInstanceCount(
	marker: GraphraumEdgeMarker | undefined,
	markerEnd: GraphraumEdgeMarkerEnd | undefined,
): number {
	if ((marker ?? "none") === "none") return 0;
	return (markerEnd ?? "target") === "both" ? 2 : 1;
}
