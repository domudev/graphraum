import { describe, expect, test } from "vitest";

import {
	assertNodeGlow,
	createGlowSelection,
	GLOW_MAX_INSTANCES,
	GLOW_RADIUS_SCALE,
	glowBufferCapacity,
	glowHaloOpacity,
	glowHaloRadius,
	selectGlowNodes,
} from "./node-glow";

function selected(selection: { count: number; indices: Uint32Array }) {
	return [...selection.indices.subarray(0, selection.count)];
}

describe("assertNodeGlow", () => {
	test("accepts undefined and the closed range 0..1", () => {
		expect(() => assertNodeGlow("a", undefined)).not.toThrow();
		expect(() => assertNodeGlow("a", 0)).not.toThrow();
		expect(() => assertNodeGlow("a", 0.5)).not.toThrow();
		expect(() => assertNodeGlow("a", 1)).not.toThrow();
	});

	test.each([-0.1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s with the node id", (glow) => {
		expect(() => assertNodeGlow("a", glow)).toThrow('Node "a" glow must be a finite number between 0 and 1');
	});
});

describe("glow halo mapping", () => {
	test("radius grows linearly from the node extent at glow 0 to 3.4x at glow 1", () => {
		expect(GLOW_RADIUS_SCALE).toBe(3.4);
		expect(glowHaloRadius(10, 0)).toBe(10);
		expect(glowHaloRadius(10, 1)).toBeCloseTo(34);
		expect(glowHaloRadius(10, 0.5)).toBeCloseTo(22);
	});

	test("opacity scales with glow", () => {
		expect(glowHaloOpacity(0)).toBe(0);
		expect(glowHaloOpacity(0.25)).toBe(0.25);
		expect(glowHaloOpacity(1)).toBe(1);
	});
});

describe("glowBufferCapacity", () => {
	test("keeps the current capacity while it fits", () => {
		expect(glowBufferCapacity(3, 8, GLOW_MAX_INSTANCES)).toBe(8);
	});

	test("grows geometrically to the next power of two", () => {
		expect(glowBufferCapacity(1, 0, GLOW_MAX_INSTANCES)).toBe(1);
		expect(glowBufferCapacity(9, 8, GLOW_MAX_INSTANCES)).toBe(16);
		expect(glowBufferCapacity(100, 0, GLOW_MAX_INSTANCES)).toBe(128);
	});

	test("never exceeds the maximum", () => {
		expect(glowBufferCapacity(10_000, 128, GLOW_MAX_INSTANCES)).toBe(GLOW_MAX_INSTANCES);
	});
});

describe("selectGlowNodes", () => {
	test("excludes nodes with glow 0 or no glow", () => {
		const glow = [0, 0.5, 0, 1];
		const selection = selectGlowNodes([0, 1, 2, 3], (index) => glow[index] ?? 0, false, createGlowSelection());
		expect(selected(selection)).toEqual([3, 1]);
	});

	test("orders by glow descending and breaks ties by node index", () => {
		const glow = [0.5, 0.9, 0.5, 0.5];
		const selection = selectGlowNodes([3, 2, 1, 0], (index) => glow[index] ?? 0, false, createGlowSelection());
		expect(selected(selection)).toEqual([1, 0, 2, 3]);
	});

	test("is deterministic regardless of visible order", () => {
		const glow = Array.from({ length: 50 }, (_, index) => ((index * 7) % 5) / 5);
		const forward = Array.from({ length: 50 }, (_, index) => index);
		const a = selected(selectGlowNodes(forward, (index) => glow[index] ?? 0, false, createGlowSelection()));
		const b = selected(
			selectGlowNodes([...forward].reverse(), (index) => glow[index] ?? 0, false, createGlowSelection()),
		);
		expect(a).toEqual(b);
	});

	test("caps the selection at 256, keeping the highest glow", () => {
		const nodeCount = 1_000;
		const glowAt = (index: number) => (index + 1) / nodeCount;
		const visible = Array.from({ length: nodeCount }, (_, index) => index);
		const selection = selectGlowNodes(visible, glowAt, false, createGlowSelection());
		expect(selection.count).toBe(GLOW_MAX_INSTANCES);
		expect(selected(selection)[0]).toBe(nodeCount - 1);
		expect(Math.min(...selected(selection))).toBe(nodeCount - GLOW_MAX_INSTANCES);
	});

	test("selects nothing in the density LOD tier", () => {
		const selection = selectGlowNodes([0, 1], () => 1, true, createGlowSelection());
		expect(selection.count).toBe(0);
	});

	test("reuses the scratch buffer and reflects updated and removed glow", () => {
		const glow = [1, 0.5];
		const scratch = createGlowSelection();
		selectGlowNodes([0, 1], (index) => glow[index] ?? 0, false, scratch);
		const buffer = scratch.indices;
		expect(selected(scratch)).toEqual([0, 1]);

		glow[0] = 0;
		selectGlowNodes([0, 1], (index) => glow[index] ?? 0, false, scratch);
		expect(selected(scratch)).toEqual([1]);
		expect(scratch.indices).toBe(buffer);

		selectGlowNodes([0], (index) => glow[index] ?? 0, false, scratch);
		expect(scratch.count).toBe(0);
	});
});
