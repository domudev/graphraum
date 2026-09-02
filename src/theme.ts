import type { GraphraumBackground, GraphraumTheme, GraphraumThemeName } from "./types";

/** Dark canvas: Ink Black, Turf Green, Porcelain. */
export const graphraumThemeDark = Object.freeze({
	background: "#040f0f",
	dimmedNode: "#315a51",
	edge: "#226f54",
	edgeOpacity: 0.55,
	edgeWidth: 1.5,
	endpointAttach: "boundary",
	focusedNode: "#73c7a5",
	hoveredNode: "#e4a853",
	node: "#226f54",
	nodeStroke: "#fcfffc",
	selectedEdge: "#fcfffc",
	selectedNode: "#fcfffc",
} satisfies GraphraumTheme);

/** Light canvas: Porcelain field with Turf marks and Ink selection. */
export const graphraumThemeLight = Object.freeze({
	background: "#fcfffc",
	dimmedNode: "#9bb5ac",
	edge: "#226f54",
	edgeOpacity: 0.65,
	edgeWidth: 1.5,
	endpointAttach: "boundary",
	focusedNode: "#1a5c45",
	hoveredNode: "#c47a1a",
	node: "#226f54",
	nodeStroke: "#040f0f",
	selectedEdge: "#040f0f",
	selectedNode: "#040f0f",
} satisfies GraphraumTheme);

export const graphraumThemes = Object.freeze({
	dark: graphraumThemeDark,
	light: graphraumThemeLight,
} satisfies Record<GraphraumThemeName, GraphraumTheme>);

/** Alias of {@link graphraumThemeDark} for backward compatibility. */
export const graphraumTheme = graphraumThemeDark;

export function resolveGraphraumTheme(
	input?: Partial<GraphraumTheme> | GraphraumThemeName,
	base: GraphraumTheme = graphraumThemeDark,
): GraphraumTheme {
	if (input === undefined) return { ...base };
	if (typeof input === "string") {
		const preset = graphraumThemes[input];
		if (!preset) {
			throw new Error(`Unknown graphraum theme "${input}". Use "dark" or "light".`);
		}
		return { ...preset };
	}
	return { ...base, ...input };
}

/** Collapse `"transparent"` onto `null` so callers have one transparent sentinel. */
export function normalizeGraphraumBackground(
	background: GraphraumBackground,
): Exclude<GraphraumBackground, "transparent"> {
	return background === "transparent" ? null : background;
}

export function isTransparentGraphraumBackground(background: GraphraumBackground): boolean {
	return normalizeGraphraumBackground(background) === null;
}
