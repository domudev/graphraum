import type { GraphraumNode, GraphraumNodeUpdate } from "./types";

export interface PreparedNodeUpdate {
	colorChanged: boolean;
	index: number;
	next: GraphraumNode;
	positionChanged: boolean;
	sizeChanged: boolean;
}

function assertFinitePosition(node: GraphraumNode) {
	for (const [axis, value] of [
		["x", node.position.x],
		["y", node.position.y],
		["z", node.position.z ?? 0],
	] as const) {
		if (!Number.isFinite(value)) throw new Error(`Node "${node.id}" has a non-finite ${axis} position`);
	}
	if (node.size !== undefined && (!Number.isFinite(node.size) || node.size <= 0)) {
		throw new Error(`Node "${node.id}" must have a positive finite size`);
	}
}

/** Validates a complete update batch before the renderer mutates CPU or GPU state. */
export function prepareNodeUpdates(
	nodes: readonly GraphraumNode[],
	nodeIndices: ReadonlyMap<string, number>,
	updates: readonly GraphraumNodeUpdate[],
): readonly PreparedNodeUpdate[] {
	const seen = new Set<string>();
	return updates.map((update) => {
		if (seen.has(update.id)) throw new Error(`Duplicate node update: "${update.id}"`);
		seen.add(update.id);
		const index = nodeIndices.get(update.id);
		if (index === undefined) throw new Error(`Cannot update missing node: "${update.id}"`);
		const current = nodes[index];
		if (!current) throw new Error(`Cannot update missing node: "${update.id}"`);
		const next: GraphraumNode = {
			...current,
			...(Object.hasOwn(update, "color") ? { color: update.color } : {}),
			...(update.position ? { position: { ...update.position } } : {}),
			...(Object.hasOwn(update, "size") ? { size: update.size } : {}),
		};
		assertFinitePosition(next);
		return {
			colorChanged: Object.hasOwn(update, "color"),
			index,
			next,
			positionChanged: update.position !== undefined,
			sizeChanged: Object.hasOwn(update, "size"),
		};
	});
}
