import type { BufferGeometry, InstancedBufferAttribute } from "three";

import type { EndpointAttach, EndpointOutline } from "./edge-endpoint-attach";
import { type EdgeMarkerInstance, type EdgeSegmentInstance, packEdgeInstances } from "./edge-materialize";
import type { EdgeLodTier } from "./edge-paths";
import type { PickableEdgeSegment } from "./edge-picking";
import { writeEdgeMarkerInstance, writeEdgeSegmentInstance } from "./edge-rendering";
import type { GraphraumColor, GraphraumEdgeVisual } from "./types";

export interface VisibleEdgeLayout {
	markerCount: number;
	markerStart: number;
	segmentCount: number;
	segmentStart: number;
}

const EDGE_INSTANCE_ATTRIBUTES = [
	"instanceKind",
	"instanceEndA",
	"instanceEndB",
	"instanceColor",
	"instanceWidth",
	"instanceStyle",
] as const;

/** Records GPU slot ranges for each visible edge after a full viewport materialize. */
export function buildVisibleEdgeLayouts(
	segments: readonly EdgeSegmentInstance[],
	markers: readonly EdgeMarkerInstance[],
	segmentInstanceCount: number,
): Map<number, VisibleEdgeLayout> {
	const layouts = new Map<number, VisibleEdgeLayout>();
	for (const [slot, segment] of segments.entries()) {
		const layout = layouts.get(segment.edgeIndex) ?? {
			markerCount: 0,
			markerStart: segmentInstanceCount,
			segmentCount: 0,
			segmentStart: slot,
		};
		if (layout.segmentCount === 0) layout.segmentStart = slot;
		layout.segmentCount += 1;
		layouts.set(segment.edgeIndex, layout);
	}
	for (const [offset, marker] of markers.entries()) {
		const slot = segmentInstanceCount + offset;
		const layout = layouts.get(marker.edgeIndex) ?? {
			markerCount: 0,
			markerStart: slot,
			segmentCount: 0,
			segmentStart: -1,
		};
		if (layout.markerCount === 0) layout.markerStart = slot;
		layout.markerCount += 1;
		layouts.set(marker.edgeIndex, layout);
	}
	return layouts;
}

export interface PatchVisibleEdgesInput {
	changedEdgeIndices: readonly number[];
	defaults: { color: GraphraumColor; opacity: number; width: number };
	edgeNodeIndices?: Uint32Array;
	edgeVisuals: readonly Readonly<GraphraumEdgeVisual>[];
	endpointAttach?: EndpointAttach;
	endpointPositions: Float32Array;
	layouts: ReadonlyMap<number, VisibleEdgeLayout>;
	minHitSlop: number;
	nodeOutlines?: readonly EndpointOutline[];
	tier: EdgeLodTier;
	worldPerPixel: number;
}

export interface PatchVisibleEdgesResult {
	dirtySlotCount: number;
	dirtySlotStart: number;
	ok: boolean;
	pickableSegments: PickableEdgeSegment[];
}

/**
 * Rewrites GPU edge instances for moved endpoints without repacking the whole viewport.
 * Returns ok=false when any visible edge would change segment or marker counts.
 */
export function patchVisibleEdgeInstances(
	geometry: BufferGeometry,
	input: PatchVisibleEdgesInput,
	pickableSegments: readonly PickableEdgeSegment[],
): PatchVisibleEdgesResult {
	const nextPickable = [...pickableSegments];
	let dirtySlotStart = Number.POSITIVE_INFINITY;
	let dirtySlotEnd = -1;
	const seen = new Set<number>();

	for (const edgeIndex of input.changedEdgeIndices) {
		if (seen.has(edgeIndex)) continue;
		seen.add(edgeIndex);
		const layout = input.layouts.get(edgeIndex);
		if (!layout || layout.segmentCount === 0 || layout.segmentStart < 0) continue;

		const packed = packEdgeInstances({
			edgeIndices: [edgeIndex],
			edgeVisuals: input.edgeVisuals,
			endpointPositions: input.endpointPositions,
			defaults: input.defaults,
			tier: input.tier,
			endpointAttach: input.endpointAttach,
			edgeNodeIndices: input.edgeNodeIndices,
			nodeOutlines: input.nodeOutlines,
		});
		if (packed.segments.length !== layout.segmentCount || packed.markers.length !== layout.markerCount) {
			return { dirtySlotCount: 0, dirtySlotStart: 0, ok: false, pickableSegments: nextPickable };
		}

		for (const [offset, segment] of packed.segments.entries()) {
			const slot = layout.segmentStart + offset;
			writeEdgeSegmentInstance(geometry, slot, segment);
			nextPickable[slot] = {
				edgeIndex,
				hitSlop: Math.max(input.minHitSlop, (segment.width * input.worldPerPixel) / 2 + 2 * input.worldPerPixel),
				x1: segment.x1,
				x2: segment.x2,
				y1: segment.y1,
				y2: segment.y2,
			};
			dirtySlotStart = Math.min(dirtySlotStart, slot);
			dirtySlotEnd = Math.max(dirtySlotEnd, slot);
		}
		for (const [offset, marker] of packed.markers.entries()) {
			const slot = layout.markerStart + offset;
			writeEdgeMarkerInstance(geometry, slot, marker);
			dirtySlotStart = Math.min(dirtySlotStart, slot);
			dirtySlotEnd = Math.max(dirtySlotEnd, slot);
		}
	}

	if (dirtySlotEnd < dirtySlotStart) {
		return { dirtySlotCount: 0, dirtySlotStart: 0, ok: true, pickableSegments: nextPickable };
	}

	for (const name of EDGE_INSTANCE_ATTRIBUTES) {
		const attribute = geometry.getAttribute(name) as InstancedBufferAttribute;
		attribute.clearUpdateRanges();
		attribute.addUpdateRange(
			dirtySlotStart * attribute.itemSize,
			(dirtySlotEnd - dirtySlotStart + 1) * attribute.itemSize,
		);
		attribute.needsUpdate = true;
	}

	return {
		dirtySlotCount: dirtySlotEnd - dirtySlotStart + 1,
		dirtySlotStart,
		ok: true,
		pickableSegments: nextPickable,
	};
}
