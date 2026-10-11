import { describe, expect, test } from "vitest";

import {
	easeInOutCubic,
	FLY_TO_DEFAULT_DURATION_MS,
	flightProgress,
	interpolateScale,
	resolveFlyToOptions,
} from "./camera-flight";

describe("resolveFlyToOptions", () => {
	test("applies defaults", () => {
		expect(resolveFlyToOptions({ nodeIds: [] })).toEqual({ distanceScale: 1, durationMs: FLY_TO_DEFAULT_DURATION_MS });
	});

	test("keeps valid values, including a zero duration", () => {
		expect(resolveFlyToOptions({ nodeIds: [], durationMs: 0, distanceScale: 1.5 })).toEqual({
			distanceScale: 1.5,
			durationMs: 0,
		});
	});

	test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects durationMs %s", (durationMs) => {
		expect(() => resolveFlyToOptions({ nodeIds: [], durationMs })).toThrow(/durationMs must be a non-negative/);
	});

	test.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])("rejects distanceScale %s", (distanceScale) => {
		expect(() => resolveFlyToOptions({ nodeIds: [], distanceScale })).toThrow(/distanceScale must be a finite/);
	});
});

describe("easeInOutCubic", () => {
	test("starts at 0, ends at 1 and passes the midpoint at 0.5", () => {
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(0.5)).toBe(0.5);
		expect(easeInOutCubic(1)).toBe(1);
	});

	test("starts and ends slowly and is symmetric", () => {
		expect(easeInOutCubic(0.1)).toBeCloseTo(0.004, 9);
		expect(easeInOutCubic(0.9)).toBeCloseTo(1 - easeInOutCubic(0.1), 12);
	});

	test("never goes backwards", () => {
		const samples = Array.from({ length: 101 }, (_, index) => easeInOutCubic(index / 100));
		expect(samples.every((value, index) => index === 0 || value >= (samples[index - 1] ?? 0))).toBe(true);
	});
});

describe("flightProgress", () => {
	test("is elapsed over duration, clamped to [0, 1]", () => {
		expect(flightProgress(250, 1000)).toBe(0.25);
		expect(flightProgress(-5, 1000)).toBe(0);
		expect(flightProgress(5000, 1000)).toBe(1);
	});

	test("a zero duration is already done", () => {
		expect(flightProgress(0, 0)).toBe(1);
	});
});

describe("interpolateScale", () => {
	test("is exact at both ends", () => {
		expect(interpolateScale(3, 7, 0)).toBe(3);
		expect(interpolateScale(3, 7, 1)).toBe(7);
	});

	test("zooms by the same factor per step", () => {
		expect(interpolateScale(100, 1, 0.5)).toBeCloseTo(10, 9);
		expect(interpolateScale(1, 16, 0.25)).toBeCloseTo(2, 9);
	});
});
