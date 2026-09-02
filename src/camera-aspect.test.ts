import { PerspectiveCamera } from "three";
import { expect, test } from "vitest";
import { applyPerspectiveContainerAspect, containerAspect } from "./camera-aspect";

test("container aspect uses width over height and never divides by zero", () => {
	expect(containerAspect(1600, 800)).toBe(2);
	expect(containerAspect(800, 1600)).toBe(0.5);
	expect(containerAspect(0, 0)).toBe(1);
});

test("perspective fit after a 2d-to-3d camera create uses the canvas aspect, not 1", () => {
	const camera = new PerspectiveCamera(45, 1, 0.1, 100_000);
	applyPerspectiveContainerAspect(camera, 1600, 800);
	expect(camera.aspect).toBe(2);
});
