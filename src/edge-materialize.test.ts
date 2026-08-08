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
			edgeVisuals: [{ marker: "triangle", markerEnd: "both", style: "dashed", width: 3, opacity: 0.9 }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "overview",
		});
		expect(packed.segments).toHaveLength(1);
		expect(packed.markers).toHaveLength(0);
		expect(packed.segments[0]?.style).toBe("solid");
		expect(packed.segments[0]?.width).toBe(1.5);
	});

	it("packs triangle markers at both ends in detail", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ marker: "triangle", markerEnd: "both", width: 2 }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
		});
		expect(packed.segments).toHaveLength(1);
		expect(packed.markers).toHaveLength(2);
		expect(packed.markers.map((m) => m.end)).toEqual(["source", "target"]);
	});
});

describe("edgeTierFromDiagnosticsLod", () => {
	it("maps only the detail LOD level to the detail edge tier", () => {
		expect(edgeTierFromDiagnosticsLod("detail")).toBe("detail");
		expect(edgeTierFromDiagnosticsLod("overview")).toBe("overview");
		expect(edgeTierFromDiagnosticsLod("density")).toBe("overview");
	});
});
