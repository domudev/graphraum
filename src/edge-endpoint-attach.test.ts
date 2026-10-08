import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { attachPointOnOutline, DEFAULT_ENDPOINT_CLEARANCE, trimEdgeEndpoints } from "./edge-endpoint-attach";
import type { GraphraumPosition } from "./types";

test("circle attach lands outside the fill and inside the stroke pad", () => {
	const center = { x: 0, y: 0, z: 0 };
	const far = { x: 40, y: 0, z: 0 };
	const point = attachPointOnOutline(center, far, { shape: "circle", size: 4, strokeWidth: 1 }, 0.5);
	expect(point.y).toBeCloseTo(0, 5);
	expect(point.x).toBeGreaterThan(3);
	expect(point.x).toBeLessThan(5);
});

test("diamond attach respects the diamond outline", () => {
	const center = { x: 0, y: 0, z: 0 };
	const far = { x: 40, y: 40, z: 0 };
	const point = attachPointOnOutline(center, far, { shape: "diamond", size: 4 }, 0);
	// Diamond boundary along y=x is at local |x|+|y|=1 → world distance 2√2 for size 4.
	expect(Math.hypot(point.x, point.y)).toBeCloseTo(2 * Math.SQRT2, 1);
});

test("clearance does not invert a short edge", () => {
	const trimmed = trimEdgeEndpoints({
		source: { x: 0, y: 0 },
		target: { x: 3, y: 0 },
		sourceOutline: { shape: "circle", size: 4 },
		targetOutline: { shape: "circle", size: 4 },
		clearance: DEFAULT_ENDPOINT_CLEARANCE,
	});
	// Overlapping outlines → fall back to centers rather than crossing.
	expect(trimmed.source.x).toBe(0);
	expect(trimmed.target.x).toBe(3);
});

test("center attach leaves endpoints unchanged", () => {
	const trimmed = trimEdgeEndpoints({
		attach: "center",
		source: { x: 1, y: 2, z: 3 },
		target: { x: 4, y: 5, z: 6 },
		sourceOutline: { shape: "circle", size: 4 },
		targetOutline: { shape: "circle", size: 4 },
	});
	expect(trimmed.source).toEqual({ x: 1, y: 2, z: 3 });
	expect(trimmed.target).toEqual({ x: 4, y: 5, z: 6 });
});

test("boundary trim shortens a long straight chord", () => {
	const trimmed = trimEdgeEndpoints({
		source: { x: 0, y: 0 },
		target: { x: 40, y: 0 },
		sourceOutline: { shape: "circle", size: 4, strokeWidth: 1 },
		targetOutline: { shape: "circle", size: 4, strokeWidth: 1 },
		clearance: 0.5,
	});
	expect(trimmed.source.x).toBeGreaterThan(3);
	expect(trimmed.target.x).toBeLessThan(37);
	expect(trimmed.target.x - trimmed.source.x).toBeLessThan(40);
});

describe("3D boundary trim", () => {
	const circle = { shape: "circle" as const, size: 4 };

	test("2D ignores depth, as before", () => {
		const trimmed = trimEdgeEndpoints({
			clearance: 0,
			source: { x: 0, y: 0, z: 0 },
			target: { x: 30, y: 0, z: 400 },
			sourceOutline: circle,
			targetOutline: circle,
		});
		// The xy part of the chord leaves the circle after 4 world units.
		expect(trimmed.source.x).toBeCloseTo(4, 4);
		expect(trimmed.source.z).toBeCloseTo((4 / 30) * 400, 2);
	});

	test("ends one radius from each center along the 3D segment", () => {
		const trimmed = trimEdgeEndpoints({
			clearance: 0,
			mode: "3d",
			source: { x: 0, y: 0, z: 0 },
			target: { x: 30, y: 0, z: 40 },
			sourceOutline: circle,
			targetOutline: { shape: "circle", size: 10, strokeWidth: 1 },
		});
		expect(trimmed.source).toMatchObject({ x: expect.closeTo(2.4, 4), y: 0, z: expect.closeTo(3.2, 4) });
		// 11 world units (size + stroke) back from the target along the 50-unit chord.
		expect(trimmed.target).toMatchObject({ x: expect.closeTo(30 - 6.6, 4), y: 0, z: expect.closeTo(40 - 8.8, 4) });
	});

	test("trims an edge that points straight at the camera instead of collapsing it", () => {
		const trimmed = trimEdgeEndpoints({
			clearance: 0,
			mode: "3d",
			source: { x: 0, y: 0, z: 0 },
			target: { x: 0, y: 0, z: 50 },
			sourceOutline: circle,
			targetOutline: circle,
		});
		expect(trimmed.source.z).toBeCloseTo(4, 4);
		expect(trimmed.target.z).toBeCloseTo(46, 4);
	});

	test("keeps 2D results for chords in the xy plane", () => {
		const outline = { shape: "diamond" as const, size: 4, strokeWidth: 0.5 };
		const input = { clearance: 0.75, source: { x: 1, y: 2, z: 5 }, target: { x: 41, y: 32, z: 5 } };
		const flat = trimEdgeEndpoints({ ...input, sourceOutline: outline, targetOutline: outline });
		const spatial = trimEdgeEndpoints({ ...input, mode: "3d", sourceOutline: outline, targetOutline: outline });
		expect(spatial.source.x).toBeCloseTo(flat.source.x, 5);
		expect(spatial.source.y).toBeCloseTo(flat.source.y, 5);
		expect(spatial.target.x).toBeCloseTo(flat.target.x, 5);
		expect(spatial.target.y).toBeCloseTo(flat.target.y, 5);
	});

	/** Screen distance from the projected center, as a fraction of the node's projected radius. */
	function projectedReach(camera: PerspectiveCamera, center: Vector3, point: GraphraumPosition, radius: number) {
		const viewCenter = center.clone().applyMatrix4(camera.matrixWorldInverse);
		// Billboards are camera-facing quads at the center's view depth, so their screen radius is
		// the world radius scaled at that depth.
		const screenRadius = radius / -viewCenter.z;
		const projectedCenter = center.clone().project(camera);
		const projectedPoint = new Vector3(point.x, point.y, point.z ?? 0).project(camera);
		const tan = Math.tan((camera.fov * Math.PI) / 360);
		const dx = (projectedPoint.x - projectedCenter.x) * tan * camera.aspect;
		const dy = (projectedPoint.y - projectedCenter.y) * tan;
		return Math.hypot(dx, dy) / screenRadius;
	}

	const random = (() => {
		let state = 11;
		return () => {
			state = (state * 1_664_525 + 1_013_904_223) >>> 0;
			return state / 2 ** 32;
		};
	})();

	test("projected ends meet the outline or sit just inside it for any camera and depth", () => {
		const reaches: number[] = [];
		for (let index = 0; index < 400; index += 1) {
			const camera = new PerspectiveCamera(45, 1.5, 0.1, 10_000);
			const theta = random() * Math.PI * 2;
			const phi = Math.acos(random() * 2 - 1);
			camera.position.setFromSphericalCoords(600, phi, theta);
			camera.lookAt(0, 0, 0);
			camera.updateMatrixWorld();
			const source = new Vector3(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100);
			const target = new Vector3(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100);
			const sourceSize = 2 + random() * 10;
			const targetSize = 2 + random() * 10;
			const trimmed = trimEdgeEndpoints({
				clearance: 0,
				mode: "3d",
				source,
				target,
				sourceOutline: { size: sourceSize },
				targetOutline: { size: targetSize },
			});
			reaches.push(projectedReach(camera, source, trimmed.source, sourceSize));
			reaches.push(projectedReach(camera, target, trimmed.target, targetSize));
		}
		// Perspective can push a point in front of the billboard a hair past the rim.
		expect(Math.max(...reaches)).toBeLessThan(1.03);
		// Edges across the view end on the outline, not short of it.
		expect(reaches.filter((reach) => reach > 0.9).length).toBeGreaterThan(reaches.length / 3);
	});

	test("an edge across the view ends on the outline at its node's depth", () => {
		const camera = new PerspectiveCamera(45, 1, 0.1, 10_000);
		camera.position.set(0, 0, 500);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();
		for (const depth of [-300, 0, 300]) {
			const source = new Vector3(0, 0, depth);
			const target = new Vector3(0, 80, depth);
			const trimmed = trimEdgeEndpoints({
				clearance: 0,
				mode: "3d",
				source,
				target,
				sourceOutline: circle,
				targetOutline: circle,
			});
			expect(projectedReach(camera, source, trimmed.source, 4)).toBeCloseTo(1, 4);
		}
	});
});
