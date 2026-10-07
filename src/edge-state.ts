import type { EdgeLodTier } from "./edge-paths";
import type { GraphraumColor, GraphraumEdgeVisual } from "./types";

/** Host-owned visual state of one edge after precedence is applied. */
export type EdgePaintState = "selected" | null;

/** Resolves host edge states during packing and incremental repaint. */
export interface EdgeStateStyling {
	selectedColor: GraphraumColor;
	/** State for a compiled edge index. */
	stateOf(edgeIndex: number): EdgePaintState;
}

export interface EdgePaint {
	color: GraphraumColor;
	opacity: number;
}

/**
 * Single source of truth for an edge instance's color and opacity. Full packing and the
 * incremental state repaint both call it, so both paths write identical instance colors.
 */
export function resolveEdgePaint(
	edgeIndex: number,
	visual: Readonly<GraphraumEdgeVisual>,
	defaults: EdgePaint,
	tier: EdgeLodTier,
	edgeStates: EdgeStateStyling | undefined,
): EdgePaint {
	const opacity = tier === "overview" ? defaults.opacity : (visual.opacity ?? defaults.opacity);
	if (edgeStates?.stateOf(edgeIndex) === "selected") return { color: edgeStates.selectedColor, opacity };
	return { color: visual.color ?? defaults.color, opacity };
}

/** IDs present in exactly one of the two sets. */
export function changedIds(current: ReadonlySet<string>, next: ReadonlySet<string>): string[] {
	return [...[...current].filter((id) => !next.has(id)), ...[...next].filter((id) => !current.has(id))];
}
