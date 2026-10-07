import type { GraphraumBackground, GraphraumTheme, GraphraumThemeName } from "./types";

/** Dark canvas: Ink Black, Turf Green, Porcelain. */
export const graphraumThemeDark = Object.freeze({
	background: "#040f0f",
	dimmedEdge: "#315a51",
	dimmedEdgeOpacity: 0.25,
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
	dimmedEdge: "#9bb5ac",
	dimmedEdgeOpacity: 0.35,
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
	return assertGraphraumTheme({ ...base, ...input });
}

function assertGraphraumTheme(theme: GraphraumTheme): GraphraumTheme {
	const opacity = theme.dimmedEdgeOpacity;
	if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
		throw new Error(`Theme dimmedEdgeOpacity must be a finite number between 0 and 1, received ${opacity}.`);
	}
	return theme;
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
