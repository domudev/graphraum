import { describe, expect, it } from "vitest";

import {
	assertEdgeMarker,
	assertEdgeMarkerEnd,
	assertEdgeStyle,
	assertEdgeVisual,
	encodeEdgeMarker,
	encodeEdgeStyle,
	graphraumEdgeMarkers,
	graphraumEdgeStyles,
	markerInstanceCount,
} from "./edge-styles";

describe("edge-styles", () => {
	it("lists supported styles and markers", () => {
		expect(graphraumEdgeStyles).toEqual(["solid", "dashed", "dotted"]);
		expect(graphraumEdgeMarkers).toEqual(["none", "triangle"]);
	});

	it("encodes style and marker for shaders", () => {
		expect(encodeEdgeStyle("solid")).toBe(0);
		expect(encodeEdgeStyle("dashed")).toBe(1);
		expect(encodeEdgeStyle("dotted")).toBe(2);
		expect(encodeEdgeMarker("none")).toBe(0);
		expect(encodeEdgeMarker("triangle")).toBe(1);
	});

	it("counts marker instances from markerEnd", () => {
		expect(markerInstanceCount("none", "target")).toBe(0);
		expect(markerInstanceCount("triangle", "target")).toBe(1);
		expect(markerInstanceCount("triangle", "source")).toBe(1);
		expect(markerInstanceCount("triangle", "both")).toBe(2);
	});

	it("rejects invalid visuals with edge id context", () => {
		expect(() => assertEdgeVisual("e1", { width: 0 })).toThrow(/e1.*width/);
		expect(() => assertEdgeVisual("e1", { opacity: 1.2 })).toThrow(/e1.*opacity/);
		expect(() => assertEdgeStyle("e1", "wave")).toThrow(/e1.*style/);
		expect(() => assertEdgeMarker("e1", "arrow")).toThrow(/e1.*marker/);
		expect(() => assertEdgeMarkerEnd("e1", "middle")).toThrow(/e1.*markerEnd/);
	});
});
