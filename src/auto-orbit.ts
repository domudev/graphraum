import type { GraphraumAutoOrbitOptions, GraphraumAutoOrbitStatus } from "./types";

export const AUTO_ORBIT_DEFAULT_SPEED = 0.07;
export const AUTO_ORBIT_MAX_SPEED = 2;
export const AUTO_ORBIT_DEFAULT_RESUME_AFTER_MS = 3000;
/** Longest frame step the orbit applies, so a throttled or backgrounded tab does not jump on return. */
export const AUTO_ORBIT_MAX_DELTA_SECONDS = 0.1;

export interface ResolvedAutoOrbitOptions {
	readonly speed: number;
	readonly resumeAfterMs: number;
}

/** Why the orbit may be stopped. The orbit runs only while enabled and none of the stop reasons hold. */
export interface AutoOrbitState {
	readonly enabled: boolean;
	readonly hidden: boolean;
	readonly interacting: boolean;
	readonly offscreen: boolean;
}

export type AutoOrbitEvent =
	| { readonly type: "enable"; readonly hidden: boolean }
	| { readonly type: "disable" }
	| { readonly type: "interaction" }
	| { readonly type: "idle" }
	| { readonly type: "visibility"; readonly hidden: boolean }
	| { readonly type: "intersection"; readonly offscreen: boolean };

export const AUTO_ORBIT_OFF: AutoOrbitState = { enabled: false, hidden: false, interacting: false, offscreen: false };

export function resolveAutoOrbitOptions(options: GraphraumAutoOrbitOptions): ResolvedAutoOrbitOptions {
	const speed = options.speed ?? AUTO_ORBIT_DEFAULT_SPEED;
	const resumeAfterMs = options.resumeAfterMs ?? AUTO_ORBIT_DEFAULT_RESUME_AFTER_MS;
	if (!Number.isFinite(speed) || speed <= 0 || speed > AUTO_ORBIT_MAX_SPEED) {
		throw new Error(
			`Auto-orbit speed must be a finite number above 0 and at most ${AUTO_ORBIT_MAX_SPEED} radians per second; received ${speed}.`,
		);
	}
	if (!Number.isFinite(resumeAfterMs) || resumeAfterMs < 0) {
		throw new Error(
			`Auto-orbit resumeAfterMs must be a non-negative finite number of milliseconds; received ${resumeAfterMs}.`,
		);
	}
	return { speed, resumeAfterMs };
}

export function nextAutoOrbitState(state: AutoOrbitState, event: AutoOrbitEvent): AutoOrbitState {
	if (event.type === "enable") {
		return state.enabled
			? { ...state, hidden: event.hidden }
			: { ...AUTO_ORBIT_OFF, enabled: true, hidden: event.hidden };
	}
	if (!state.enabled) return state;
	switch (event.type) {
		case "disable":
			return AUTO_ORBIT_OFF;
		case "interaction":
			return { ...state, interacting: true };
		case "idle":
			return { ...state, interacting: false };
		case "visibility":
			return { ...state, hidden: event.hidden };
		case "intersection":
			return { ...state, offscreen: event.offscreen };
	}
}

export function autoOrbitStatus(state: AutoOrbitState): GraphraumAutoOrbitStatus {
	if (!state.enabled) return "off";
	return state.hidden || state.interacting || state.offscreen ? "paused" : "active";
}

/** Seconds between two animation-frame timestamps, zero on the first frame, clamped to `[0, AUTO_ORBIT_MAX_DELTA_SECONDS]`. */
export function autoOrbitDeltaSeconds(previousMs: number | null, nowMs: number): number {
	if (previousMs === null) return 0;
	return Math.min(Math.max((nowMs - previousMs) / 1000, 0), AUTO_ORBIT_MAX_DELTA_SECONDS);
}

/**
 * OrbitControls (three r185) rotates `(2π / 60) * autoRotateSpeed * deltaTime` radians when
 * `update(deltaTime)` receives seconds (and a fixed per-call step without it). Inverting that
 * gives an `autoRotateSpeed` for which `update(dtSeconds)` turns exactly `radiansPerSecond`,
 * independent of frame rate.
 */
export function autoRotateSpeedFor(radiansPerSecond: number): number {
	return (radiansPerSecond * 60) / (2 * Math.PI);
}
