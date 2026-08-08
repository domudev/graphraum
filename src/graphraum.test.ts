import { describe, expect, test } from "vitest";

import { edgeInstanceCapacities } from "./graphraum";

describe("edgeInstanceCapacities", () => {
	test("keeps marker capacity at exactly 2x edge capacity, even for an empty graph", () => {
		const capacities = edgeInstanceCapacities(0, 100_000);
		expect(capacities.markerCapacity).toBe(2 * capacities.edgeCapacity);
		expect(capacities.edgeInstanceCapacity).toBe(capacities.edgeCapacity + capacities.markerCapacity);
	});

	test("grows edge capacity geometrically and doubles it for markers", () => {
		expect(edgeInstanceCapacities(10, 100_000)).toEqual({
			edgeCapacity: 16,
			markerCapacity: 32,
			edgeInstanceCapacity: 48,
		});
	});

	test("caps edge capacity at maxVisibleEdges without under-provisioning markers", () => {
		expect(edgeInstanceCapacities(1_000, 100)).toEqual({
			edgeCapacity: 100,
			markerCapacity: 200,
			edgeInstanceCapacity: 300,
		});
	});
});
