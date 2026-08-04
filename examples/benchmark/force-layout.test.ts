import { expect, test } from "vitest";

import { computeForcePositions } from "./force-layout";

test("keeps 2D force positions flat and gives 3D positions depth", () => {
	const edges = new Uint32Array([0, 1, 1, 2]);
	const flat = computeForcePositions({ dimensions: 2, edges, nodeCount: 4 });
	const spatial = computeForcePositions({ dimensions: 3, edges, nodeCount: 4 });

	expect(Array.from(flat.filter((_, index) => index % 3 === 2))).toEqual([0, 0, 0, 0]);
	expect(Array.from(spatial.filter((_, index) => index % 3 === 2))).not.toEqual([0, 0, 0, 0]);
});
