import { resolveNodeAxes } from "./node-axes";
import { assertNodeShape } from "./node-shapes";
import type { GraphraumNode, GraphraumNodeGeometry, GraphraumNodeUpdate } from "./types";

export interface PreparedNodeUpdate<NodeAttributes = undefined> {
	colorChanged: boolean;
	index: number;
	next: GraphraumNode<NodeAttributes>;
	positionChanged: boolean;
	shapeChanged: boolean;
	/** True when `size`, `width`, or `height` changed — the matrix scale must be rewritten. */
	sizeChanged: boolean;
	/** True when `strokeWidth` or `strokeColor` changed — the stroke attributes must be rewritten. */
	strokeChanged: boolean;
}

function assertValidNode(node: GraphraumNodeGeometry) {
	for (const [axis, value] of [
		["x", node.position.x],
		["y", node.position.y],
		["z", node.position.z ?? 0],
	] as const) {
		if (!Number.isFinite(value)) throw new Error(`Node "${node.id}" has a non-finite ${axis} position`);
	}
	resolveNodeAxes({ height: node.height, nodeId: node.id, size: node.size, width: node.width });
	if (node.strokeWidth !== undefined && (!Number.isFinite(node.strokeWidth) || node.strokeWidth < 0)) {
		throw new Error(`Node "${node.id}" must have a finite non-negative strokeWidth`);
	}
	if (node.shape !== undefined) assertNodeShape(node.id, node.shape);
}

/** Validates a complete update batch before the renderer mutates CPU or GPU state. */
export function prepareNodeUpdates<NodeAttributes = undefined>(
	nodes: readonly GraphraumNode<NodeAttributes>[],
	nodeIndices: ReadonlyMap<string, number>,
	updates: readonly GraphraumNodeUpdate[],
): readonly PreparedNodeUpdate<NodeAttributes>[] {
	const seen = new Set<string>();
	return updates.map((update) => {
		if (seen.has(update.id)) throw new Error(`Duplicate node update: "${update.id}"`);
		seen.add(update.id);
		const index = nodeIndices.get(update.id);
		if (index === undefined) throw new Error(`Cannot update missing node: "${update.id}"`);
		const current = nodes[index];
		if (!current) throw new Error(`Cannot update missing node: "${update.id}"`);
		const next: GraphraumNode<NodeAttributes> = {
			...current,
			...(Object.hasOwn(update, "color") ? { color: update.color } : {}),
			...(update.position ? { position: { ...update.position } } : {}),
			...(Object.hasOwn(update, "shape") ? { shape: update.shape } : {}),
			...(Object.hasOwn(update, "size") ? { size: update.size } : {}),
			...(Object.hasOwn(update, "width") ? { width: update.width } : {}),
			...(Object.hasOwn(update, "height") ? { height: update.height } : {}),
			...(Object.hasOwn(update, "strokeWidth") ? { strokeWidth: update.strokeWidth } : {}),
			...(Object.hasOwn(update, "strokeColor") ? { strokeColor: update.strokeColor } : {}),
		};
		assertValidNode(next);
		return {
			colorChanged: Object.hasOwn(update, "color"),
			index,
			next,
			positionChanged: update.position !== undefined,
			shapeChanged: Object.hasOwn(update, "shape"),
			sizeChanged: Object.hasOwn(update, "size") || Object.hasOwn(update, "width") || Object.hasOwn(update, "height"),
			strokeChanged: Object.hasOwn(update, "strokeWidth") || Object.hasOwn(update, "strokeColor"),
		};
	});
}
