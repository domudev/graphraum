import { describe, expect, test } from "vitest";

import { resolveNodeAxes } from "./node-axes";

describe("resolveNodeAxes", () => {
	test("falls back to the default size when size, width, and height are all omitted", () => {
		expect(resolveNodeAxes({})).toEqual({ width: 4, height: 4 });
	});

	test("uses size as a uniform shorthand for both axes", () => {
		expect(resolveNodeAxes({ size: 6 })).toEqual({ width: 6, height: 6 });
	});

	test("lets width and height override size independently", () => {
		expect(resolveNodeAxes({ size: 6, width: 10 })).toEqual({ width: 10, height: 6 });
		expect(resolveNodeAxes({ size: 6, height: 2 })).toEqual({ width: 6, height: 2 });
		expect(resolveNodeAxes({ width: 8, height: 3 })).toEqual({ width: 8, height: 3 });
	});

	test("honors a caller-supplied defaultSize", () => {
		expect(resolveNodeAxes({ defaultSize: 10 })).toEqual({ width: 10, height: 10 });
	});

	test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		"rejects a non-positive or non-finite resolved width (%s)",
		(width) => {
			expect(() => resolveNodeAxes({ width })).toThrow("width must be a positive finite number");
		},
	);

	test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		"rejects a non-positive or non-finite resolved height (%s)",
		(height) => {
			expect(() => resolveNodeAxes({ height })).toThrow("height must be a positive finite number");
		},
	);

	test("rejects a non-positive or non-finite size shorthand for both axes", () => {
		expect(() => resolveNodeAxes({ size: 0 })).toThrow("width must be a positive finite number");
	});

	test("includes the node id in the error message when provided", () => {
		expect(() => resolveNodeAxes({ nodeId: "customer-42", width: 0 })).toThrow(
			'Node "customer-42" width must be a positive finite number',
		);
		expect(() => resolveNodeAxes({ nodeId: "customer-42", height: -5 })).toThrow(
			'Node "customer-42" height must be a positive finite number',
		);
	});

	test("omits the node id preamble when it is not provided", () => {
		expect(() => resolveNodeAxes({ width: 0 })).toThrow(/^width must be a positive finite number/);
	});
});
