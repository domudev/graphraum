import type { InstancedBufferAttribute } from "three";
import { describe, expect, test } from "vitest";

import {
	createEdgeGeometry,
	createEdgeMaterial,
	writeEdgeMarkerInstance,
	writeEdgeSegmentInstance,
} from "./edge-rendering";

describe("edge rendering buffers", () => {
	test("configures edge depth for the active dimension", () => {
		const overlay = createEdgeMaterial(false);
		const spatial = createEdgeMaterial(true);

		expect(overlay.vertexShader).toContain("attribute vec3 instanceEndA;");
		expect(overlay.depthTest).toBe(false);
		expect(overlay.depthWrite).toBe(false);
		expect(spatial.depthTest).toBe(true);
		expect(spatial.depthWrite).toBe(true);
		overlay.dispose();
		spatial.dispose();
	});

	test("creates all instanced attributes at the requested capacity", () => {
		const geometry = createEdgeGeometry(4);
		for (const name of [
			"instanceKind",
			"instanceEndA",
			"instanceEndB",
			"instanceColor",
			"instanceWidth",
			"instanceStyle",
		]) {
			const attribute = geometry.getAttribute(name) as InstancedBufferAttribute;
			expect(attribute).toBeDefined();
			expect(attribute.count).toBe(4);
		}
		geometry.dispose();
	});
});

describe("edge-rendering attributes", () => {
	test("writes segment endpoints and style codes", () => {
		const geometry = createEdgeGeometry(2);
		const kind = geometry.getAttribute("instanceKind") as InstancedBufferAttribute;
		const a = geometry.getAttribute("instanceEndA") as InstancedBufferAttribute;
		const b = geometry.getAttribute("instanceEndB") as InstancedBufferAttribute;
		const color = geometry.getAttribute("instanceColor") as InstancedBufferAttribute;
		const width = geometry.getAttribute("instanceWidth") as InstancedBufferAttribute;
		const style = geometry.getAttribute("instanceStyle") as InstancedBufferAttribute;
		writeEdgeSegmentInstance(geometry, 0, {
			edgeIndex: 0,
			x1: 0,
			y1: 0,
			z1: 0,
			x2: 10,
			y2: 0,
			z2: 0,
			color: "#226f54",
			width: 2,
			opacity: 0.5,
			style: "dashed",
		});
		expect(kind.getX(0)).toBe(0);
		expect(a.getX(0)).toBe(0);
		expect(a.getY(0)).toBe(0);
		expect(a.getZ(0)).toBe(0);
		expect(b.getX(0)).toBe(10);
		expect(b.getY(0)).toBe(0);
		expect(b.getZ(0)).toBe(0);
		expect(width.getX(0)).toBe(2);
		expect(color.getW(0)).toBeCloseTo(0.5);
		expect(style.getX(0)).toBe(1); // dashed
	});

	test("writes marker kind and size", () => {
		const geometry = createEdgeGeometry(2);
		const kind = geometry.getAttribute("instanceKind") as InstancedBufferAttribute;
		const a = geometry.getAttribute("instanceEndA") as InstancedBufferAttribute;
		const b = geometry.getAttribute("instanceEndB") as InstancedBufferAttribute;
		const width = geometry.getAttribute("instanceWidth") as InstancedBufferAttribute;
		const style = geometry.getAttribute("instanceStyle") as InstancedBufferAttribute;
		const color = geometry.getAttribute("instanceColor") as InstancedBufferAttribute;
		writeEdgeMarkerInstance(geometry, 1, {
			edgeIndex: 0,
			end: "target",
			x: 10,
			y: 0,
			z: 0,
			dx: 10,
			dy: 0,
			dz: 0,
			color: "#226f54",
			size: 3,
			opacity: 0.9,
		});
		expect(kind.getX(1)).toBe(1);
		expect(width.getX(1)).toBe(3);
		expect(style.getX(1)).toBe(0);
		expect(a.getX(1)).toBe(10);
		expect(a.getY(1)).toBe(0);
		expect(a.getZ(1)).toBe(0);
		expect(b.getX(1)).toBe(20);
		expect(b.getY(1)).toBe(0);
		expect(b.getZ(1)).toBe(0);
		expect(color.getW(1)).toBeCloseTo(0.9);
	});

	test("does not disturb neighboring slots", () => {
		const geometry = createEdgeGeometry(2);
		const kind = geometry.getAttribute("instanceKind") as InstancedBufferAttribute;
		writeEdgeSegmentInstance(geometry, 0, {
			edgeIndex: 0,
			x1: 0,
			y1: 0,
			z1: 0,
			x2: 1,
			y2: 1,
			z2: 1,
			color: "#000000",
			width: 1,
			opacity: 1,
			style: "solid",
		});
		writeEdgeMarkerInstance(geometry, 1, {
			edgeIndex: 0,
			end: "target",
			x: 1,
			y: 1,
			z: 1,
			dx: 1,
			dy: 0,
			dz: 0,
			color: "#ffffff",
			size: 2,
			opacity: 1,
		});
		expect(kind.getX(0)).toBe(0);
		expect(kind.getX(1)).toBe(1);
	});
});
