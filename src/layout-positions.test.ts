import { describe, expect, test } from "vitest";

import { prepareLayoutPositions } from "./layout-positions";

const nodes = [
	{ id: "a", position: { x: 1, y: 2 } },
	{ id: "b", position: { x: 3, y: 4 } },
] as const;
const indices = new Map([
	["a", 0],
	["b", 1],
]);

describe("prepareLayoutPositions", () => {
	test("maps a transferable XYZ batch without mutating the source", () => {
		const updates = prepareLayoutPositions(nodes, indices, {
			nodeIds: ["b"],
			positions: new Float32Array([8, 9, 10]),
		});

		expect(updates).toMatchObject([{ index: 1, next: { id: "b", position: { x: 8, y: 9, z: 10 } } }]);
		expect(nodes[1]).toEqual({ id: "b", position: { x: 3, y: 4 } });
	});

	test.each([
		[{ nodeIds: [], positions: new Float32Array([1, 2, 3]) }, "one XYZ triplet"],
		[{ nodeIds: ["a"], positions: new Float32Array([1, 2]) }, "one XYZ triplet"],
		[{ nodeIds: ["a", "a"], positions: new Float32Array([1, 2, 3, 4, 5, 6]) }, "Duplicate layout"],
		[{ nodeIds: ["missing"], positions: new Float32Array([1, 2, 3]) }, "missing node"],
		[{ nodeIds: ["a"], positions: new Float32Array([Number.NaN, 2, 3]) }, "non-finite x"],
	])("rejects invalid layout input", (layout, message) => {
		expect(() => prepareLayoutPositions(nodes, indices, layout)).toThrow(message);
	});
});
