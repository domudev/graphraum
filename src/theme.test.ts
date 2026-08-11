import { describe, expect, it } from "vitest";
import {
	graphraumTheme,
	graphraumThemeDark,
	graphraumThemeLight,
	graphraumThemes,
	isTransparentGraphraumBackground,
	normalizeGraphraumBackground,
	resolveGraphraumTheme,
} from "./theme";

describe("graphraum themes", () => {
	it("keeps graphraumTheme as the immutable dark preset alias", () => {
		expect(graphraumTheme).toBe(graphraumThemeDark);
		expect(graphraumTheme).toEqual({
			background: "#040f0f",
			dimmedNode: "#315a51",
			edge: "#226f54",
			edgeOpacity: 0.55,
			edgeWidth: 1.5,
			focusedNode: "#73c7a5",
			hoveredNode: "#e4a853",
			node: "#226f54",
			nodeStroke: "#fcfffc",
			selectedEdge: "#fcfffc",
			selectedNode: "#fcfffc",
		});
		expect(Object.isFrozen(graphraumTheme)).toBe(true);
	});

	it("exports a light preset with porcelain field and ink selection", () => {
		expect(graphraumThemeLight).toEqual({
			background: "#fcfffc",
			dimmedNode: "#9bb5ac",
			edge: "#226f54",
			edgeOpacity: 0.65,
			edgeWidth: 1.5,
			focusedNode: "#1a5c45",
			hoveredNode: "#c47a1a",
			node: "#226f54",
			nodeStroke: "#040f0f",
			selectedEdge: "#040f0f",
			selectedNode: "#040f0f",
		});
		expect(graphraumThemes.light).toBe(graphraumThemeLight);
		expect(Object.isFrozen(graphraumThemeLight)).toBe(true);
	});

	it("resolves named presets and merges partial overrides onto the active base", () => {
		expect(resolveGraphraumTheme("light").background).toBe("#fcfffc");
		expect(resolveGraphraumTheme({ edgeWidth: 3 })).toEqual({
			...graphraumThemeDark,
			edgeWidth: 3,
		});
		expect(resolveGraphraumTheme({ node: "#6d5bd0" }, graphraumThemeLight)).toEqual({
			...graphraumThemeLight,
			node: "#6d5bd0",
		});
	});

	it("normalizes transparent backgrounds for host CSS patterns", () => {
		expect(normalizeGraphraumBackground("transparent")).toBeNull();
		expect(normalizeGraphraumBackground(null)).toBeNull();
		expect(normalizeGraphraumBackground("#040f0f")).toBe("#040f0f");
		expect(isTransparentGraphraumBackground("transparent")).toBe(true);
		expect(isTransparentGraphraumBackground({ type: "pattern", source: {} as CanvasImageSource })).toBe(false);
	});
});
