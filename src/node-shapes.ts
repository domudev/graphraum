import type { GraphraumNodeShape } from "./types";

export const graphraumNodeShapes = [
	"circle",
	"square",
	"diamond",
	"hexagon",
	"triangle",
	"pill",
	"rounded",
] as const satisfies readonly GraphraumNodeShape[];

const shapeCodes: Readonly<Record<GraphraumNodeShape, number>> = {
	circle: 0,
	square: 1,
	diamond: 2,
	hexagon: 3,
	triangle: 4,
	pill: 5,
	rounded: 6,
};

export function assertNodeShape(nodeId: string, shape: unknown): asserts shape is GraphraumNodeShape {
	if (typeof shape !== "string" || !graphraumNodeShapes.includes(shape as GraphraumNodeShape)) {
		throw new Error(
			`Node "${nodeId}" shape must be one of: ${graphraumNodeShapes.map((candidate) => `"${candidate}"`).join(", ")}`,
		);
	}
}

export function encodeNodeShape(shape: GraphraumNodeShape | undefined): number {
	return shapeCodes[shape ?? "circle"];
}

/** Half-height of the horizontal pill's rounded caps, in unit space. */
const PILL_CAP_RADIUS = 0.5;
/** Half-length of the pill's straight segment, in unit space (leaves room for the caps within [-1, 1]). */
const PILL_HALF_LENGTH = 1 - PILL_CAP_RADIUS;
/** Apothem of a regular hexagon whose pointy left/right vertices reach x = ±1. */
const HEXAGON_APOTHEM = Math.sqrt(3) / 2;
/** Y of the upward triangle's flat base, given an apex at (0, 1) and an equilateral shape spanning x = [-1, 1]. */
const TRIANGLE_BASE_Y = 1 - Math.sqrt(3);
/** Fraction of the rounded rectangle's half-extent used as the corner radius. */
const ROUNDED_CORNER_RADIUS = 0.25;

function containsHexagon(x: number, y: number): boolean {
	const absX = Math.abs(x);
	const absY = Math.abs(y);
	return Math.max(absY, absX * HEXAGON_APOTHEM + absY * 0.5) <= HEXAGON_APOTHEM;
}

function edgeCross(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
	return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function containsTriangle(x: number, y: number): boolean {
	const apexX = 0;
	const apexY = 1;
	const rightX = 1;
	const leftX = -1;
	const baseY = TRIANGLE_BASE_Y;

	const d1 = edgeCross(apexX, apexY, rightX, baseY, x, y);
	const d2 = edgeCross(rightX, baseY, leftX, baseY, x, y);
	const d3 = edgeCross(leftX, baseY, apexX, apexY, x, y);

	const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNegative && hasPositive);
}

function containsPill(x: number, y: number): boolean {
	const clampedX = Math.max(-PILL_HALF_LENGTH, Math.min(PILL_HALF_LENGTH, x));
	const dx = x - clampedX;
	return dx * dx + y * y <= PILL_CAP_RADIUS * PILL_CAP_RADIUS;
}

function containsRounded(x: number, y: number): boolean {
	const innerHalfExtent = 1 - ROUNDED_CORNER_RADIUS;
	const qx = Math.abs(x) - innerHalfExtent;
	const qy = Math.abs(y) - innerHalfExtent;
	const outsideX = Math.max(qx, 0);
	const outsideY = Math.max(qy, 0);
	const outsideDistance =
		Math.sqrt(outsideX * outsideX + outsideY * outsideY) + Math.min(Math.max(qx, qy), 0) - ROUNDED_CORNER_RADIUS;
	return outsideDistance <= 0;
}

export function containsNodePoint(shape: GraphraumNodeShape | undefined, x: number, y: number): boolean {
	switch (shape ?? "circle") {
		case "square":
			return Math.max(Math.abs(x), Math.abs(y)) <= 1;
		case "diamond":
			return Math.abs(x) + Math.abs(y) <= 1;
		case "hexagon":
			return containsHexagon(x, y);
		case "triangle":
			return containsTriangle(x, y);
		case "pill":
			return containsPill(x, y);
		case "rounded":
			return containsRounded(x, y);
		default:
			return x ** 2 + y ** 2 <= 1;
	}
}
