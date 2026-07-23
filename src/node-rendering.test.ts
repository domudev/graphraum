import type { InstancedBufferAttribute } from "three";
import { describe, expect, test } from "vitest";

import { createNodeGeometry, setNodeShapeAt } from "./node-rendering";

describe("node rendering buffers", () => {
	test("packs mixed shapes into one instanced geometry", () => {
		const geometry = createNodeGeometry(4);
		const shapes = geometry.getAttribute("instanceShape") as InstancedBufferAttribute;
		setNodeShapeAt(shapes, 0, undefined);
		setNodeShapeAt(shapes, 1, "circle");
		setNodeShapeAt(shapes, 2, "square");
		setNodeShapeAt(shapes, 3, "diamond");

		expect(shapes.count).toBe(4);
		expect([...shapes.array]).toEqual([0, 0, 1, 2]);
		geometry.dispose();
	});
});
