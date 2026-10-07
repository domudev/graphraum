import { describe, expect, test } from "vitest";

import { type FitNode, fitPerspective, type PerspectiveFit } from "./fit-3d";

const FILL = 0.94;

function fitNodes(nodes: readonly FitNode[], aspect: number): PerspectiveFit | null {
	return fitPerspective(
		{ aspect, fill: FILL, fovDegrees: 45 },
		{ count: nodes.length, read: (index, out) => Object.assign(out, nodes[index]) },
	);
}

/** Farthest screen reach (NDC) of any billboard edge on each side, plus the depth range. */
function reach(fit: PerspectiveFit, nodes: readonly FitNode[], aspect: number) {
	const tan = Math.tan(Math.PI / 8);
	return nodes.reduce(
		(acc, node) => {
			const depth = fit.cameraZ - node.z;
			const width = depth * tan * aspect;
			const height = depth * tan;
			return {
				bottom: Math.max(acc.bottom, (fit.target.y - node.y + node.halfHeight) / height),
				farthest: Math.max(acc.farthest, depth),
				left: Math.max(acc.left, (fit.target.x - node.x + node.halfWidth) / width),
				nearest: Math.min(acc.nearest, depth),
				right: Math.max(acc.right, (node.x - fit.target.x + node.halfWidth) / width),
				top: Math.max(acc.top, (node.y - fit.target.y + node.halfHeight) / height),
			};
		},
		{ bottom: 0, farthest: 0, left: 0, nearest: Number.POSITIVE_INFINITY, right: 0, top: 0 },
	);
}

/** Every node fits, the tighter axis touches the margin, and both axes are centred on screen. */
function expectTightFit(nodes: readonly FitNode[], aspect: number) {
	const fit = fitNodes(nodes, aspect);
	if (!fit) throw new Error("expected a fit");
	const { bottom, farthest, left, nearest, right, top } = reach(fit, nodes, aspect);
	const x = Math.max(left, right);
	const y = Math.max(top, bottom);
	expect(x).toBeLessThanOrEqual(FILL + 1e-9);
	expect(y).toBeLessThanOrEqual(FILL + 1e-9);
	expect(Math.max(x, y)).toBeCloseTo(FILL, 9);
	expect(left).toBeCloseTo(right, 9);
	expect(top).toBeCloseTo(bottom, 9);
	expect(nearest).toBeGreaterThan(fit.near);
	expect(farthest).toBeLessThan(fit.far);
	expect(fit.cameraZ).toBeGreaterThan(fit.target.z);
	return { fit, x, y };
}

function node(x: number, y: number, z: number, radius = 1): FitNode {
	return { halfHeight: radius, halfWidth: radius, x, y, z };
}

function cube(half: number): FitNode[] {
	return [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => node(sx * half, sy * half, sz * half))));
}

function sheet(width: number, height: number, step: number): FitNode[] {
	const nodes: FitNode[] = [];
	for (let x = -width / 2; x <= width / 2; x += step) {
		for (let y = -height / 2; y <= height / 2; y += step) nodes.push(node(x, y, 0, 2));
	}
	return nodes;
}

describe("PerspectiveFitBounds", () => {
	test("returns null without nodes", () => {
		expect(fitNodes([], 1.5)).toBeNull();
	});

	test("frames a single node by its radius", () => {
		const { fit, x, y } = expectTightFit([node(10, -20, 5, 3)], 1);
		expect(fit.target).toEqual({ x: 10, y: -20, z: 5 });
		expect(x).toBeCloseTo(FILL, 9);
		expect(y).toBeCloseTo(FILL, 9);
	});

	test("frames a cube on a square canvas", () => {
		const { fit } = expectTightFit(cube(100), 1);
		expect(fit.target).toEqual({ x: 0, y: 0, z: 0 });
	});

	test("lets a wide sheet use the width of a wide canvas", () => {
		const nodes = sheet(600, 200, 10);
		const { x, y } = expectTightFit(nodes, 1792 / 1150);
		expect(x).toBeCloseTo(FILL, 9);
		expect(y).toBeLessThan(x);
	});

	test("fits the width first on a tall canvas", () => {
		const { x, y } = expectTightFit(sheet(600, 200, 10), 0.6);
		expect(x).toBeCloseTo(FILL, 9);
		expect(y).toBeLessThan(0.5);
	});

	test("centres an off-centre cloud and keeps the deep side in view", () => {
		const nodes = [node(1000, 500, -300, 4), node(1400, 520, 200, 2), node(1100, 700, 50, 8), node(1300, 610, -80)];
		expectTightFit(nodes, 1.3);
	});

	test("centres the looser axis on screen when its extremes sit at different depths", () => {
		const nodes = [node(-400, 0, 0, 2), node(400, 0, 0, 2), node(0, 100, 300, 2), node(0, -100, -300, 2)];
		const { fit, x, y } = expectTightFit(nodes, 1.6);
		expect(x).toBeCloseTo(FILL, 9);
		expect(y).toBeLessThan(x);
		expect(fit.target.y).toBeGreaterThan(0);
	});

	test("frames collinear nodes along the view axis", () => {
		const nodes = Array.from({ length: 11 }, (_, index) => node(0, 0, index * 1000, 2));
		const { fit } = expectTightFit(nodes, 1.5);
		expect(fit.cameraZ).toBeGreaterThan(10_000);
	});

	test("frames huge and tiny coordinates", () => {
		expectTightFit(
			cube(1e7).map((n) => ({ ...n, x: n.x + 1e8 })),
			1.5,
		);
		expectTightFit(
			sheet(0.002, 0.001, 0.0005).map((n) => ({ ...n, halfHeight: 1e-4, halfWidth: 1e-4 })),
			1.5,
		);
	});

	test("uses separate half extents per axis", () => {
		const { x, y } = expectTightFit([node(0, 0, 0), { halfHeight: 1, halfWidth: 10, x: 50, y: 0, z: 0 }], 1);
		expect(x).toBeCloseTo(FILL, 9);
		expect(y).toBeLessThan(x);
	});

	test("is deterministic and independent of node order", () => {
		const nodes = sheet(300, 120, 15).map((n, index) => ({ ...n, z: (index * 37) % 50 }));
		const first = fitNodes(nodes, 1.4);
		expect(fitNodes(nodes, 1.4)).toEqual(first);
		expect(fitNodes([...nodes].reverse(), 1.4)).toEqual(first);
	});
});
