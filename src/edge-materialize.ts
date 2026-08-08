import { type EdgeLodTier, sampleEdgePath } from "./edge-paths";
import type { GraphraumColor, GraphraumEdgeMarkerEnd, GraphraumEdgeStyle, GraphraumEdgeVisual } from "./types";

export type { EdgeLodTier };

export interface EdgeSegmentInstance {
	edgeIndex: number;
	x1: number;
	y1: number;
	z1: number;
	x2: number;
	y2: number;
	z2: number;
	color: GraphraumColor;
	width: number;
	opacity: number;
	style: GraphraumEdgeStyle;
}

export interface EdgeMarkerInstance {
	edgeIndex: number;
	end: "source" | "target";
	x: number;
	y: number;
	z: number;
	dx: number;
	dy: number;
	dz: number; // direction along edge for orientation
	color: GraphraumColor;
	size: number; // screen px, derived from width * markerSize
	opacity: number;
}

export function packEdgeInstances(input: {
	edgeIndices: readonly number[];
	edgeVisuals: readonly Readonly<GraphraumEdgeVisual>[];
	endpointPositions: Float32Array; // 6 floats per edge index in canonical order
	defaults: { color: GraphraumColor; opacity: number; width: number };
	tier: EdgeLodTier;
	/** Soft cap on segment instances; remaining edges are skipped when exceeded. */
	maxSegments?: number;
}): { segments: EdgeSegmentInstance[]; markers: EdgeMarkerInstance[]; truncated: boolean } {
	const segments: EdgeSegmentInstance[] = [];
	const markers: EdgeMarkerInstance[] = [];
	let truncated = false;
	for (const edgeIndex of input.edgeIndices) {
		const visual = input.edgeVisuals[edgeIndex] ?? {};
		const base = edgeIndex * 6;
		const x1 = input.endpointPositions[base] ?? 0;
		const y1 = input.endpointPositions[base + 1] ?? 0;
		const z1 = input.endpointPositions[base + 2] ?? 0;
		const x2 = input.endpointPositions[base + 3] ?? 0;
		const y2 = input.endpointPositions[base + 4] ?? 0;
		const z2 = input.endpointPositions[base + 5] ?? 0;
		const color = visual.color ?? input.defaults.color;
		const width = input.tier === "overview" ? input.defaults.width : (visual.width ?? input.defaults.width);
		const opacity = input.tier === "overview" ? input.defaults.opacity : (visual.opacity ?? input.defaults.opacity);
		const style = input.tier === "overview" ? "solid" : (visual.style ?? "solid");
		const points = sampleEdgePath({
			path: visual.path,
			controlPoints: visual.controlPoints,
			tier: input.tier,
			x1,
			y1,
			z1,
			x2,
			y2,
			z2,
		});
		const segmentSpans = Math.max(0, points.length - 1);
		if (input.maxSegments !== undefined && segments.length + segmentSpans > input.maxSegments) {
			truncated = true;
			break;
		}
		for (let index = 0; index < segmentSpans; index += 1) {
			const from = points[index];
			const to = points[index + 1];
			if (!from || !to) continue;
			segments.push({
				edgeIndex,
				x1: from.x,
				y1: from.y,
				z1: from.z ?? 0,
				x2: to.x,
				y2: to.y,
				z2: to.z ?? 0,
				color,
				width,
				opacity,
				style,
			});
		}

		if (input.tier === "overview") continue;
		const marker = visual.marker ?? "none";
		if (marker === "none") continue;
		const markerSize = (visual.markerSize ?? 1) * width;
		const ends: GraphraumEdgeMarkerEnd = visual.markerEnd ?? "target";
		const first = points[0];
		const second = points[1] ?? points[0];
		const last = points.at(-1);
		const previous = points.at(-2) ?? last;
		if (!first || !second || !last || !previous) continue;
		const add = (end: "source" | "target") => {
			const fromSource = end === "source";
			markers.push({
				edgeIndex,
				end,
				x: fromSource ? first.x : last.x,
				y: fromSource ? first.y : last.y,
				z: fromSource ? (first.z ?? 0) : (last.z ?? 0),
				dx: fromSource ? first.x - second.x : last.x - previous.x,
				dy: fromSource ? first.y - second.y : last.y - previous.y,
				dz: fromSource ? (first.z ?? 0) - (second.z ?? 0) : (last.z ?? 0) - (previous.z ?? 0),
				color,
				size: markerSize,
				opacity,
			});
		};
		if (ends === "source" || ends === "both") add("source");
		if (ends === "target" || ends === "both") add("target");
	}
	return { segments, markers, truncated };
}

/** Map existing diagnostics lodLevel into the edge visual tier. */
export function edgeTierFromDiagnosticsLod(lodLevel: "density" | "detail" | "overview"): EdgeLodTier {
	return lodLevel === "detail" ? "detail" : "overview";
}
