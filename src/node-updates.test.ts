import { describe, expect, test } from "vitest";

import { prepareNodeUpdates } from "./node-updates";

const nodes = [
	{ id: "a", position: { x: 1, y: 2 }, color: "red", size: 4 },
	{ id: "b", position: { x: 3, y: 4 } },
] as const;
const indices = new Map([
	["a", 0],
	["b", 1],
]);

describe("prepareNodeUpdates", () => {
	test("merges partial updates without mutating the source", () => {
		const prepared = prepareNodeUpdates(nodes, indices, [
			{ id: "a", position: { x: 8, y: 9 }, color: undefined, shape: "diamond" },
		]);
		expect(prepared).toEqual([
			{
				colorChanged: true,
				index: 0,
				next: { id: "a", position: { x: 8, y: 9 }, color: undefined, shape: "diamond", size: 4 },
				positionChanged: true,
				shapeChanged: true,
				sizeChanged: false,
			},
		]);
		expect(nodes[0]).toEqual({ id: "a", position: { x: 1, y: 2 }, color: "red", size: 4 });
	});

	test("rejects an invalid batch before renderer mutation", () => {
		expect(() => prepareNodeUpdates(nodes, indices, [{ id: "a", size: 0 }])).toThrow("positive finite size");
		expect(() => prepareNodeUpdates(nodes, indices, [{ id: "a", shape: "hexagon" as "circle" }])).toThrow(
			'Node "a" shape must be one of',
		);
		expect(() => prepareNodeUpdates(nodes, indices, [{ id: "missing", size: 2 }])).toThrow(
			'Cannot update missing node: "missing"',
		);
		expect(() =>
			prepareNodeUpdates(nodes, indices, [
				{ id: "a", size: 2 },
				{ id: "a", size: 3 },
			]),
		).toThrow('Duplicate node update: "a"');
	});
});
