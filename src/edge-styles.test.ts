import { describe, expect, test } from "vitest";

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
	test("lists supported styles and markers", () => {
		expect(graphraumEdgeStyles).toEqual(["solid", "dashed", "dotted"]);
		expect(graphraumEdgeMarkers).toEqual(["none", "triangle"]);
	});

	test("encodes the public style and marker unions into stable shader values", () => {
		expect(graphraumEdgeStyles.map(encodeEdgeStyle)).toEqual([0, 1, 2]);
		expect(graphraumEdgeMarkers.map(encodeEdgeMarker)).toEqual([0, 1]);
		expect(encodeEdgeStyle(undefined)).toBe(0);
		expect(encodeEdgeMarker(undefined)).toBe(0);
	});

	test("counts marker instances from markerEnd", () => {
		expect(markerInstanceCount("none", "target")).toBe(0);
		expect(markerInstanceCount("triangle", "target")).toBe(1);
		expect(markerInstanceCount("triangle", "source")).toBe(1);
		expect(markerInstanceCount("triangle", "both")).toBe(2);
	});

	test("rejects invalid visuals with edge id context", () => {
		expect(() => assertEdgeVisual("e1", { width: 0 })).toThrow(/e1.*width/);
		expect(() => assertEdgeVisual("e1", { opacity: 1.2 })).toThrow(/e1.*opacity/);
		expect(() => assertEdgeVisual("e1", { markerSize: 0 })).toThrow(/e1.*markerSize/);
		expect(() => assertEdgeStyle("e1", "wave")).toThrow(/e1.*style/);
		expect(() => assertEdgeMarker("e1", "arrow")).toThrow(/e1.*marker/);
		expect(() => assertEdgeMarkerEnd("e1", "middle")).toThrow(/e1.*markerEnd/);
	});
});
