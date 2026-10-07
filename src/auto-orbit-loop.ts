import {
	AUTO_ORBIT_OFF,
	type AutoOrbitEvent,
	type AutoOrbitState,
	autoOrbitDeltaSeconds,
	autoOrbitStatus,
	nextAutoOrbitState,
} from "./auto-orbit";
import type { GraphraumAutoOrbitStatus } from "./types";

/**
 * Owns the auto-orbit frame loop and the browser signals that stop it. The loop exists only
 * while the orbit is active: pointer, wheel and key input pause it until `resumeAfterMs` of
 * idle, and a hidden document or an off-screen element stop it until they change back.
 * Decisions come from the pure state in `auto-orbit.ts`; this class only wires DOM events,
 * the resume timer and `requestAnimationFrame`.
 */
export class AutoOrbitLoop {
	private state: AutoOrbitState;
	private frame: number | null = null;
	private lastFrameMs: number | null = null;
	private resumeTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly observer: IntersectionObserver | null;

	constructor(
		private readonly element: HTMLElement,
		private resumeAfterMs: number,
		private readonly step: (deltaSeconds: number) => void,
	) {
		this.state = nextAutoOrbitState(AUTO_ORBIT_OFF, { type: "enable", hidden: element.ownerDocument.hidden });
		element.addEventListener("pointerdown", this.handlePointerDown);
		element.addEventListener("pointerup", this.handlePointerRelease);
		element.addEventListener("pointercancel", this.handlePointerRelease);
		element.addEventListener("wheel", this.handleDiscreteInput, { passive: true });
		element.addEventListener("keydown", this.handleDiscreteInput);
		element.ownerDocument.addEventListener("visibilitychange", this.handleVisibilityChange);
		// Without IntersectionObserver (old browsers, test DOMs) the element counts as on screen.
		this.observer =
			typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(this.handleIntersection);
		this.observer?.observe(element);
		this.sync();
	}

	get status(): GraphraumAutoOrbitStatus {
		return autoOrbitStatus(this.state);
	}

	setResumeAfterMs(resumeAfterMs: number) {
		this.resumeAfterMs = resumeAfterMs;
	}

	dispose() {
		this.element.removeEventListener("pointerdown", this.handlePointerDown);
		this.element.removeEventListener("pointerup", this.handlePointerRelease);
		this.element.removeEventListener("pointercancel", this.handlePointerRelease);
		this.element.removeEventListener("wheel", this.handleDiscreteInput);
		this.element.removeEventListener("keydown", this.handleDiscreteInput);
		this.element.ownerDocument.removeEventListener("visibilitychange", this.handleVisibilityChange);
		this.observer?.disconnect();
		this.clearResumeTimer();
		this.dispatch({ type: "disable" });
	}

	private dispatch(event: AutoOrbitEvent) {
		this.state = nextAutoOrbitState(this.state, event);
		this.sync();
	}

	/** Starts the frame loop when the orbit becomes active and cancels it otherwise. */
	private sync() {
		const active = this.status === "active";
		if (active && this.frame === null) {
			this.lastFrameMs = null;
			this.frame = requestAnimationFrame(this.tick);
		} else if (!active && this.frame !== null) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
	}

	private readonly tick = (nowMs: number) => {
		this.frame = null;
		const deltaSeconds = autoOrbitDeltaSeconds(this.lastFrameMs, nowMs);
		this.lastFrameMs = nowMs;
		this.step(deltaSeconds);
		if (this.frame === null && this.status === "active") this.frame = requestAnimationFrame(this.tick);
	};

	private armResumeTimer() {
		this.clearResumeTimer();
		this.resumeTimer = setTimeout(() => {
			this.resumeTimer = null;
			this.dispatch({ type: "idle" });
		}, this.resumeAfterMs);
	}

	private clearResumeTimer() {
		if (this.resumeTimer === null) return;
		clearTimeout(this.resumeTimer);
		this.resumeTimer = null;
	}

	/** A press pauses until it is released; the idle countdown starts on release. */
	private readonly handlePointerDown = () => {
		this.clearResumeTimer();
		this.dispatch({ type: "interaction" });
	};

	private readonly handlePointerRelease = () => {
		if (this.state.interacting) this.armResumeTimer();
	};

	private readonly handleDiscreteInput = () => {
		this.dispatch({ type: "interaction" });
		this.armResumeTimer();
	};

	private readonly handleVisibilityChange = () => {
		this.dispatch({ type: "visibility", hidden: this.element.ownerDocument.hidden });
	};

	private readonly handleIntersection = (entries: readonly IntersectionObserverEntry[]) => {
		const entry = entries.at(-1);
		if (entry) this.dispatch({ type: "intersection", offscreen: !entry.isIntersecting });
	};
}
