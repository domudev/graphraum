/** Canvas aspect used by perspective cameras. Never 0. */
export function containerAspect(width: number, height: number): number {
	return Math.max(width, 1) / Math.max(height, 1);
}

/** Keep a perspective camera from stretching on a non-square canvas. */
export function applyPerspectiveContainerAspect(camera: { aspect: number }, width: number, height: number): void {
	camera.aspect = containerAspect(width, height);
}
