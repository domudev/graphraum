import { describe, expect, test } from "vitest";

import {
	AUTO_ORBIT_MAX_DELTA_SECONDS,
	AUTO_ORBIT_OFF,
	type AutoOrbitState,
	autoOrbitDeltaSeconds,
	autoOrbitStatus,
	autoRotateSpeedFor,
	nextAutoOrbitState,
	resolveAutoOrbitOptions,
} from "./auto-orbit";

const enabled = nextAutoOrbitState(AUTO_ORBIT_OFF, { type: "enable", hidden: false });

describe("resolveAutoOrbitOptions", () => {
	test("applies defaults", () => {
		expect(resolveAutoOrbitOptions({})).toEqual({ speed: 0.07, resumeAfterMs: 3000 });
	});

	test("keeps valid values", () => {
		expect(resolveAutoOrbitOptions({ speed: 2, resumeAfterMs: 0 })).toEqual({ speed: 2, resumeAfterMs: 0 });
	});

	test.each([0, -0.1, 2.01, Number.NaN, Number.POSITIVE_INFINITY])("rejects speed %s", (speed) => {
		expect(() => resolveAutoOrbitOptions({ speed })).toThrow(/speed must be a finite number above 0 and at most 2/);
	});

	test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects resumeAfterMs %s", (resumeAfterMs) => {
		expect(() => resolveAutoOrbitOptions({ resumeAfterMs })).toThrow(
			/resumeAfterMs must be a non-negative finite number/,
		);
	});
});

describe("auto-orbit state", () => {
	test("starts off", () => {
		expect(autoOrbitStatus(AUTO_ORBIT_OFF)).toBe("off");
	});

	test("enable makes it active, or paused when the document is hidden", () => {
		expect(autoOrbitStatus(enabled)).toBe("active");
		expect(autoOrbitStatus(nextAutoOrbitState(AUTO_ORBIT_OFF, { type: "enable", hidden: true }))).toBe("paused");
	});

	test("interaction pauses until idle", () => {
		const interacting = nextAutoOrbitState(enabled, { type: "interaction" });
		expect(autoOrbitStatus(interacting)).toBe("paused");
		expect(autoOrbitStatus(nextAutoOrbitState(interacting, { type: "idle" }))).toBe("active");
	});

	test("hidden and offscreen stop the orbit and visibility restarts it", () => {
		const hidden = nextAutoOrbitState(enabled, { type: "visibility", hidden: true });
		expect(autoOrbitStatus(hidden)).toBe("paused");
		expect(autoOrbitStatus(nextAutoOrbitState(hidden, { type: "visibility", hidden: false }))).toBe("active");

		const offscreen = nextAutoOrbitState(enabled, { type: "intersection", offscreen: true });
		expect(autoOrbitStatus(offscreen)).toBe("paused");
		expect(autoOrbitStatus(nextAutoOrbitState(offscreen, { type: "intersection", offscreen: false }))).toBe("active");
	});

	test("stays paused while any stop reason remains", () => {
		const both: AutoOrbitState = nextAutoOrbitState(nextAutoOrbitState(enabled, { type: "interaction" }), {
			type: "visibility",
			hidden: true,
		});
		expect(autoOrbitStatus(nextAutoOrbitState(both, { type: "idle" }))).toBe("paused");
	});

	test("re-enabling keeps the current pause reasons", () => {
		const interacting = nextAutoOrbitState(enabled, { type: "interaction" });
		expect(autoOrbitStatus(nextAutoOrbitState(interacting, { type: "enable", hidden: false }))).toBe("paused");
	});

	test("disable turns it off and ignores later events", () => {
		const off = nextAutoOrbitState(enabled, { type: "disable" });
		expect(off).toEqual(AUTO_ORBIT_OFF);
		expect(nextAutoOrbitState(off, { type: "idle" })).toBe(off);
		expect(nextAutoOrbitState(off, { type: "visibility", hidden: true })).toBe(off);
	});
});

describe("autoOrbitDeltaSeconds", () => {
	test("is zero on the first frame", () => {
		expect(autoOrbitDeltaSeconds(null, 1000)).toBe(0);
	});

	test("converts milliseconds to seconds", () => {
		expect(autoOrbitDeltaSeconds(1000, 1016)).toBeCloseTo(0.016);
	});

	test("clamps long gaps and negative deltas", () => {
		expect(autoOrbitDeltaSeconds(0, 60_000)).toBe(AUTO_ORBIT_MAX_DELTA_SECONDS);
		expect(AUTO_ORBIT_MAX_DELTA_SECONDS).toBe(0.1);
		expect(autoOrbitDeltaSeconds(1000, 990)).toBe(0);
	});
});

describe("autoRotateSpeedFor", () => {
	test("maps radians per second to OrbitControls autoRotateSpeed", () => {
		// OrbitControls rotates (2π / 60) * autoRotateSpeed * deltaTime radians per update.
		const speed = 0.07;
		expect(((2 * Math.PI) / 60) * autoRotateSpeedFor(speed)).toBeCloseTo(speed);
	});
});
