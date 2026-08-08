import type { GraphraumColor, GraphraumEdgeMarkerEnd, GraphraumEdgeStyle, GraphraumEdgeVisual } from "./types";

export type EdgeLodTier = "overview" | "detail";

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
}): { segments: EdgeSegmentInstance[]; markers: EdgeMarkerInstance[] } {
	const segments: EdgeSegmentInstance[] = [];
	const markers: EdgeMarkerInstance[] = [];
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
		segments.push({ edgeIndex, x1, y1, z1, x2, y2, z2, color, width, opacity, style });

		if (input.tier === "overview") continue;
		const marker = visual.marker ?? "none";
		if (marker === "none") continue;
		const markerSize = (visual.markerSize ?? 1) * width;
		const ends: GraphraumEdgeMarkerEnd = visual.markerEnd ?? "target";
		const add = (end: "source" | "target") => {
			const fromSource = end === "source";
			markers.push({
				edgeIndex,
				end,
				x: fromSource ? x1 : x2,
				y: fromSource ? y1 : y2,
				z: fromSource ? z1 : z2,
				dx: fromSource ? x1 - x2 : x2 - x1,
				dy: fromSource ? y1 - y2 : y2 - y1,
				dz: fromSource ? z1 - z2 : z2 - z1,
				color,
				size: markerSize,
				opacity,
			});
		};
		if (ends === "source" || ends === "both") add("source");
		if (ends === "target" || ends === "both") add("target");
	}
	return { segments, markers };
}

/** Map existing diagnostics lodLevel into the edge visual tier. */
export function edgeTierFromDiagnosticsLod(
	lodLevel: "density" | "detail" | "overview",
): EdgeLodTier {
	return lodLevel === "detail" ? "detail" : "overview";
}
