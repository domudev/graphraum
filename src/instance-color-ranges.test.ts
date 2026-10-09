import { InstancedBufferAttribute } from "three";
import { describe, expect, test } from "vitest";

import { markInstanceColorSlots } from "./instance-color-ranges";

describe("markInstanceColorSlots", () => {
	test("marks one RGB range per slot", () => {
		const attribute = new InstancedBufferAttribute(new Float32Array(30), 3);

		expect(markInstanceColorSlots(attribute, [2, 5])).toBe(2);
		expect(attribute.updateRanges).toEqual([
			{ start: 6, count: 3 },
			{ start: 15, count: 3 },
		]);
		expect(attribute.version).toBeGreaterThan(0);
	});

	test("keeps a full range queued by a viewport materialize that has not been uploaded yet", () => {
		const attribute = new InstancedBufferAttribute(new Float32Array(30), 3);
		attribute.addUpdateRange(0, 30);

		markInstanceColorSlots(attribute, [4]);

		expect(attribute.updateRanges).toContainEqual({ start: 0, count: 30 });
		expect(attribute.updateRanges).toContainEqual({ start: 12, count: 3 });
	});

	test("skips invalid slots and leaves needsUpdate false when empty", () => {
		const attribute = {
			needsUpdate: false,
			addUpdateRange() {
				throw new Error("should not mark ranges");
			},
		};
		expect(markInstanceColorSlots(attribute, [-1, 1.5, Number.NaN])).toBe(0);
		expect(attribute.needsUpdate).toBe(false);
	});
});
