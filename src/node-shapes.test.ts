import { describe, expect, test } from "vitest";

import { assertNodeShape, containsNodePoint, encodeNodeShape, graphraumNodeShapes } from "./node-shapes";

describe("node shapes", () => {
	test("encodes the public shape union into stable shader values", () => {
		expect(graphraumNodeShapes).toEqual(["circle", "square", "diamond"]);
		expect(graphraumNodeShapes.map(encodeNodeShape)).toEqual([0, 1, 2]);
		expect(encodeNodeShape(undefined)).toBe(0);
	});

	test("matches picking tolerance to the rendered shape boundary", () => {
		expect(containsNodePoint("circle", 0.8, 0.8)).toBe(false);
		expect(containsNodePoint("square", 0.8, 0.8)).toBe(true);
		expect(containsNodePoint("diamond", 0.6, 0.6)).toBe(false);
		expect(containsNodePoint("diamond", 0.4, 0.4)).toBe(true);
	});

	test("reports the node identity and supported values for invalid runtime input", () => {
		expect(() => assertNodeShape("customer-42", "hexagon")).toThrow(
			'Node "customer-42" shape must be one of: "circle", "square", "diamond"',
		);
	});
});
