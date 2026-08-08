import type { GraphraumTheme } from "./types";

/** The canonical Ink Black, Turf Green, and Porcelain graphraum renderer palette. */
export const graphraumTheme = Object.freeze({
	background: "#040f0f",
	dimmedNode: "#315a51",
	edge: "#226f54",
	edgeOpacity: 0.55,
	edgeWidth: 1.5,
	focusedNode: "#73c7a5",
	hoveredNode: "#e4a853",
	node: "#226f54",
	nodeStroke: "#fcfffc",
	selectedNode: "#fcfffc",
} satisfies GraphraumTheme);
