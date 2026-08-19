import { describe, expect, test } from "vitest";

import { markInstanceColorSlots } from "./instance-color-ranges";

describe("markInstanceColorSlots", () => {
	test("clears previous ranges and marks RGB ranges per slot", () => {
		const ranges: Array<{ count: number; start: number }> = [];
		const attribute = {
			needsUpdate: false,
			clearUpdateRanges() {
				ranges.length = 0;
			},
			addUpdateRange(start: number, count: number) {
				ranges.push({ start, count });
			},
		};

		expect(markInstanceColorSlots(attribute, [2, 5])).toBe(2);
		expect(ranges).toEqual([
			{ start: 6, count: 3 },
			{ start: 15, count: 3 },
		]);
		expect(attribute.needsUpdate).toBe(true);
	});

	test("skips invalid slots and leaves needsUpdate false when empty", () => {
		const attribute = {
			needsUpdate: false,
			clearUpdateRanges() {},
			addUpdateRange() {
				throw new Error("should not mark ranges");
			},
		};
		expect(markInstanceColorSlots(attribute, [-1, 1.5, Number.NaN])).toBe(0);
		expect(attribute.needsUpdate).toBe(false);
	});
});
