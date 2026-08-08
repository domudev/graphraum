import { describe, expect, test } from "vitest";

import { DETAIL_MAX_SEGMENTS } from "./edge-paths";
import { edgeInstanceCapacities } from "./graphraum";

describe("edgeInstanceCapacities", () => {
	test("sizes segments for cubic detail and markers at 2x edges", () => {
		const capacities = edgeInstanceCapacities(0, 100_000);
		expect(capacities.segmentCapacity).toBe(capacities.edgeCapacity * DETAIL_MAX_SEGMENTS);
		expect(capacities.markerCapacity).toBe(2 * capacities.edgeCapacity);
		expect(capacities.edgeInstanceCapacity).toBe(capacities.segmentCapacity + capacities.markerCapacity);
	});

	test("grows edge capacity geometrically and expands segments/markers from it", () => {
		expect(edgeInstanceCapacities(10, 100_000)).toEqual({
			edgeCapacity: 16,
			segmentCapacity: 16 * DETAIL_MAX_SEGMENTS,
			markerCapacity: 32,
			edgeInstanceCapacity: 16 * DETAIL_MAX_SEGMENTS + 32,
		});
	});

	test("caps edge capacity at maxVisibleEdges without under-provisioning markers", () => {
		expect(edgeInstanceCapacities(1_000, 100)).toEqual({
			edgeCapacity: 100,
			segmentCapacity: 100 * DETAIL_MAX_SEGMENTS,
			markerCapacity: 200,
			edgeInstanceCapacity: 100 * DETAIL_MAX_SEGMENTS + 200,
		});
	});
});
