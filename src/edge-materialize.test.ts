import { describe, expect, it } from "vitest";
import { edgeTierFromDiagnosticsLod, packEdgeInstances } from "./edge-materialize";

const endpoints = {
	// edge 0: a(0,0,0) -> b(10,0,0)
	positions: new Float32Array([0, 0, 0, 10, 0, 0]),
};

describe("packEdgeInstances", () => {
	it("packs one segment and omits markers in overview", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ marker: "triangle", markerEnd: "both", style: "dashed", width: 3, opacity: 0.9, path: "cubic" }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "overview",
		});
		expect(packed.segments).toHaveLength(1);
		expect(packed.markers).toHaveLength(0);
		expect(packed.truncated).toBe(false);
		expect(packed.segments[0]?.style).toBe("solid");
		expect(packed.segments[0]?.width).toBe(1.5);
	});

	it("expands quadratic and cubic paths in detail", () => {
		const quadratic = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ path: "quadratic", controlPoints: [{ x: 5, y: 4, z: 0 }] }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
		});
		expect(quadratic.segments).toHaveLength(16);

		const cubic = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ path: "cubic" }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
		});
		expect(cubic.segments).toHaveLength(24);
	});

	it("packs triangle markers using end-segment tangents in detail", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [
				{
					marker: "triangle",
					markerEnd: "both",
					width: 2,
					path: "quadratic",
					controlPoints: [{ x: 5, y: 5, z: 0 }],
				},
			],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
		});
		expect(packed.markers).toHaveLength(2);
		expect(packed.markers.map((m) => m.end)).toEqual(["source", "target"]);
		const target = packed.markers.find((marker) => marker.end === "target");
		expect(target?.dx).not.toBe(0);
	});

	it("stops packing when the segment budget is exceeded", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ path: "cubic" }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
			maxSegments: 4,
		});
		expect(packed.truncated).toBe(true);
		expect(packed.segments).toHaveLength(0);
	});

	it("boundary attach shortens straight segments toward node rims", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ path: "straight" }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
			endpointAttach: "boundary",
			edgeNodeIndices: new Uint32Array([0, 1]),
			nodeOutlines: [
				{ shape: "circle", size: 4, strokeWidth: 1 },
				{ shape: "circle", size: 4, strokeWidth: 1 },
			],
		});
		expect(packed.segments).toHaveLength(1);
		const segment = packed.segments[0];
		expect(segment?.x1).toBeGreaterThan(0);
		expect(segment?.x2).toBeLessThan(10);
		expect((segment?.x2 ?? 0) - (segment?.x1 ?? 0)).toBeLessThan(10);
	});
});

describe("edgeTierFromDiagnosticsLod", () => {
	it("maps only the detail LOD level to the detail edge tier", () => {
		expect(edgeTierFromDiagnosticsLod("detail")).toBe("detail");
		expect(edgeTierFromDiagnosticsLod("overview")).toBe("overview");
		expect(edgeTierFromDiagnosticsLod("density")).toBe("overview");
	});
});
