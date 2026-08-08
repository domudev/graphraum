import { describe, expect, test } from "vitest";

import { assertNodeShape, containsNodePoint, encodeNodeShape, graphraumNodeShapes } from "./node-shapes";

describe("node shapes", () => {
	test("encodes the public shape union into stable shader values", () => {
		expect(graphraumNodeShapes).toEqual(["circle", "square", "diamond", "hexagon", "triangle", "pill", "rounded"]);
		expect(graphraumNodeShapes.map(encodeNodeShape)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(encodeNodeShape(undefined)).toBe(0);
	});

	test("matches picking tolerance to the rendered shape boundary", () => {
		expect(containsNodePoint("circle", 0.8, 0.8)).toBe(false);
		expect(containsNodePoint("square", 0.8, 0.8)).toBe(true);
		expect(containsNodePoint("diamond", 0.6, 0.6)).toBe(false);
		expect(containsNodePoint("diamond", 0.4, 0.4)).toBe(true);
	});

	test("hits inside the hexagon's pointy left/right vertices and rejects outside them", () => {
		expect(containsNodePoint("hexagon", 0, 0)).toBe(true);
		expect(containsNodePoint("hexagon", 0.99, 0)).toBe(true);
		expect(containsNodePoint("hexagon", 1, 0)).toBe(true);
		expect(containsNodePoint("hexagon", 1.01, 0)).toBe(false);
	});

	test("rejects points above the hexagon's flat top edge", () => {
		expect(containsNodePoint("hexagon", 0, 0.86)).toBe(true);
		expect(containsNodePoint("hexagon", 0, 0.87)).toBe(false);
	});

	test("rejects points beyond the hexagon's slanted corner edges", () => {
		expect(containsNodePoint("hexagon", 0.9, 0.6)).toBe(false);
	});

	test("hits inside the upward-pointing triangle's apex, base, and centroid", () => {
		expect(containsNodePoint("triangle", 0, 1)).toBe(true);
		expect(containsNodePoint("triangle", 0, 0)).toBe(true);
		expect(containsNodePoint("triangle", 0, 1.01)).toBe(false);
	});

	test("rejects points outside the triangle's slanted edges", () => {
		expect(containsNodePoint("triangle", 0.9, 0.9)).toBe(false);
		expect(containsNodePoint("triangle", -0.9, 0.9)).toBe(false);
	});

	test("rejects points below the triangle's flat base", () => {
		expect(containsNodePoint("triangle", 0, -0.8)).toBe(false);
	});

	test("hits inside the horizontal pill and rejects beyond its rounded ends", () => {
		expect(containsNodePoint("pill", 0, 0)).toBe(true);
		expect(containsNodePoint("pill", 1, 0)).toBe(true);
		expect(containsNodePoint("pill", 0, 0.5)).toBe(true);
		expect(containsNodePoint("pill", 0, 0.51)).toBe(false);
	});

	test("hits and rejects points near the pill's rounded end off-axis", () => {
		expect(containsNodePoint("pill", 0.8, 0.3)).toBe(true);
		expect(containsNodePoint("pill", 1, 0.5)).toBe(false);
	});

	test("hits inside the rounded rectangle's flat edges and rejects its clipped corners", () => {
		expect(containsNodePoint("rounded", 1, 0)).toBe(true);
		expect(containsNodePoint("rounded", 0, 1)).toBe(true);
		expect(containsNodePoint("rounded", 1, 1)).toBe(false);
	});

	test("matches the rounded rectangle's corner radius arc", () => {
		expect(containsNodePoint("rounded", 0.9, 0.9)).toBe(true);
		expect(containsNodePoint("rounded", 0.95, 0.95)).toBe(false);
	});

	test("reports the node identity and supported values for invalid runtime input", () => {
		expect(() => assertNodeShape("customer-42", "octagon")).toThrow(
			'Node "customer-42" shape must be one of: "circle", "square", "diamond", "hexagon", "triangle", "pill", "rounded"',
		);
	});
});
