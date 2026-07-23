import type { GraphraumNodeShape } from "./types";

export const graphraumNodeShapes = ["circle", "square", "diamond"] as const satisfies readonly GraphraumNodeShape[];

const shapeCodes: Readonly<Record<GraphraumNodeShape, number>> = {
	circle: 0,
	square: 1,
	diamond: 2,
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

export function containsNodePoint(shape: GraphraumNodeShape | undefined, x: number, y: number): boolean {
	switch (shape ?? "circle") {
		case "square":
			return Math.max(Math.abs(x), Math.abs(y)) <= 1;
		case "diamond":
			return Math.abs(x) + Math.abs(y) <= 1;
		default:
			return x ** 2 + y ** 2 <= 1;
	}
}
