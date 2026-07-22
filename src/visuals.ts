import type { GraphraumVisualMapper } from "./types";

/** Defines typed, serializable graph visuals without coupling application data to the render loop. */
export function defineVisuals<NodeAttributes = undefined, EdgeAttributes = undefined>(
	visuals: GraphraumVisualMapper<NodeAttributes, EdgeAttributes>,
): GraphraumVisualMapper<NodeAttributes, EdgeAttributes> {
	return visuals;
}
