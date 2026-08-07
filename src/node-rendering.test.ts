import type { InstancedBufferAttribute } from "three";
import { describe, expect, test } from "vitest";

import { createNodeGeometry, createNodeMaterial, setNodeShapeAt } from "./node-rendering";

describe("node rendering buffers", () => {
	test("configures node depth for the active dimension", () => {
		const overlay = createNodeMaterial(false);
		const spatial = createNodeMaterial(true);

		expect(overlay.vertexShader).toContain("attribute vec3 instanceColor;");
		expect(overlay.depthTest).toBe(false);
		expect(overlay.depthWrite).toBe(false);
		expect(spatial.depthTest).toBe(true);
		expect(spatial.depthWrite).toBe(true);
		overlay.dispose();
		spatial.dispose();
	});

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
