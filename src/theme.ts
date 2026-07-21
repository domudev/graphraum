import type { GraphraumTheme } from "./types";

/** The canonical Ink Black, Turf Green, and Porcelain graphraum renderer palette. */
export const graphraumTheme = Object.freeze({
	background: "#040f0f",
	edge: "#226f54",
	node: "#226f54",
	selectedNode: "#fcfffc",
} satisfies GraphraumTheme);
