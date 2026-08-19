import { describe, expect, test } from "vitest";

import { packEdgeInstances } from "./edge-materialize";
import type { PickableEdgeSegment } from "./edge-picking";
import { createEdgeGeometry, writeEdgeSegmentInstance } from "./edge-rendering";
import { buildVisibleEdgeLayouts, patchVisibleEdgeInstances } from "./edge-viewport-patch";

describe("buildVisibleEdgeLayouts", () => {
	test("records segment and marker slot ranges per edge", () => {
		const packed = packEdgeInstances({
			defaults: { color: "#226f54", opacity: 0.85, width: 1.5 },
			edgeIndices: [0, 1],
			edgeVisuals: [{ path: "straight", marker: "triangle", markerEnd: "target" }, { path: "quadratic" }],
			endpointPositions: new Float32Array([0, 0, 0, 10, 0, 0, 1, 1, 0, 11, 1, 0]),
			tier: "detail",
		});
		const layouts = buildVisibleEdgeLayouts(packed.segments, packed.markers, packed.segments.length);
		expect(layouts.get(0)).toEqual({
			markerCount: 1,
			markerStart: packed.segments.length,
			segmentCount: 1,
			segmentStart: 0,
		});
		expect(layouts.get(1)?.segmentCount).toBeGreaterThan(1);
		expect(layouts.get(1)?.markerCount).toBe(0);
	});
});

describe("patchVisibleEdgeInstances", () => {
	test("updates segment attributes in place when endpoint positions move", () => {
		const geometry = createEdgeGeometry(32);
		const endpointPositions = new Float32Array([0, 0, 0, 10, 0, 0]);
		const packed = packEdgeInstances({
			defaults: { color: "#226f54", opacity: 0.85, width: 1.5 },
			edgeIndices: [0],
			edgeVisuals: [{ path: "straight" }],
			endpointPositions,
			tier: "detail",
		});
		for (const [slot, segment] of packed.segments.entries()) {
			writeEdgeSegmentInstance(geometry, slot, segment);
		}
		const layouts = buildVisibleEdgeLayouts(packed.segments, packed.markers, packed.segments.length);
		const pickable: PickableEdgeSegment[] = packed.segments.map((segment) => ({
			edgeIndex: 0,
			hitSlop: 2,
			x1: segment.x1,
			x2: segment.x2,
			y1: segment.y1,
			y2: segment.y2,
		}));

		endpointPositions.set([2, 3, 0, 12, 4, 0]);
		const result = patchVisibleEdgeInstances(
			geometry,
			{
				changedEdgeIndices: [0],
				defaults: { color: "#226f54", opacity: 0.85, width: 1.5 },
				edgeVisuals: [{ path: "straight" }],
				endpointPositions,
				layouts,
				minHitSlop: 2,
				tier: "detail",
				worldPerPixel: 1,
			},
			pickable,
		);

		expect(result.ok).toBe(true);
		expect(result.pickableSegments[0]).toMatchObject({ x1: 2, y1: 3, x2: 12, y2: 4 });
		const endA = geometry.getAttribute("instanceEndA");
		expect(endA.getX(0)).toBeCloseTo(2);
		expect(endA.getY(0)).toBeCloseTo(3);
		const endB = geometry.getAttribute("instanceEndB");
		expect(endB.getX(0)).toBeCloseTo(12);
		expect(endB.getY(0)).toBeCloseTo(4);
	});

	test("returns ok=false when segment count would change", () => {
		const geometry = createEdgeGeometry(32);
		const endpointPositions = new Float32Array([0, 0, 0, 10, 0, 0]);
		const overview = packEdgeInstances({
			defaults: { color: "#226f54", opacity: 0.85, width: 1.5 },
			edgeIndices: [0],
			edgeVisuals: [{ path: "quadratic" }],
			endpointPositions,
			tier: "overview",
		});
		const layouts = buildVisibleEdgeLayouts(overview.segments, overview.markers, overview.segments.length);
		const pickable: PickableEdgeSegment[] = overview.segments.map((segment) => ({
			edgeIndex: 0,
			hitSlop: 2,
			x1: segment.x1,
			x2: segment.x2,
			y1: segment.y1,
			y2: segment.y2,
		}));

		const result = patchVisibleEdgeInstances(
			geometry,
			{
				changedEdgeIndices: [0],
				defaults: { color: "#226f54", opacity: 0.85, width: 1.5 },
				edgeVisuals: [{ path: "quadratic" }],
				endpointPositions,
				layouts,
				minHitSlop: 2,
				tier: "detail",
				worldPerPixel: 1,
			},
			pickable,
		);

		expect(result.ok).toBe(false);
	});
});
