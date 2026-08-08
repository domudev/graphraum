import { describe, expect, test } from "vitest";

import {
	assertEdgeMarker,
	assertEdgeMarkerEnd,
	assertEdgePath,
	assertEdgeStyle,
	assertEdgeVisual,
	encodeEdgeMarker,
	encodeEdgeStyle,
	graphraumEdgeMarkers,
	graphraumEdgePaths,
	graphraumEdgeStyles,
	markerInstanceCount,
} from "./edge-styles";

describe("edge-styles", () => {
	test("lists supported styles and markers", () => {
		expect(graphraumEdgeStyles).toEqual(["solid", "dashed", "dotted"]);
		expect(graphraumEdgeMarkers).toEqual(["none", "triangle"]);
		expect(graphraumEdgePaths).toEqual(["straight", "quadratic", "cubic"]);
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
		expect(() => assertEdgePath("e1", "step")).toThrow(/e1.*path/);
		expect(() => assertEdgeVisual("e1", { path: "quadratic", controlPoints: [] })).not.toThrow();
		expect(() =>
			assertEdgeVisual("e1", {
				path: "quadratic",
				controlPoints: [
					{ x: 1, y: 2 },
					{ x: 3, y: 4 },
				],
			}),
		).toThrow(/e1.*expects 1 control point/);
		expect(() => assertEdgeVisual("e1", { path: "cubic", controlPoints: [{ x: 1, y: 2 }] })).toThrow(
			/e1.*expects 2 control points/,
		);
		expect(() => assertEdgeVisual("e1", { path: "quadratic", controlPoints: [{ x: Number.NaN, y: 0 }] })).toThrow(
			/e1.*controlPoints\[0\]/,
		);
	});
});
