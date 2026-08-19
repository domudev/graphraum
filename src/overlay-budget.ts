export type RichNodePolicy = "selected" | "hovered" | "focus";

function uniqueIds(ids: Iterable<string>): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const id of ids) {
		if (seen.has(id)) continue;
		seen.add(id);
		ordered.push(id);
	}
	return ordered;
}

export function boundOverlayIds(ids: Iterable<string>, max: number, kind: string): string[] {
	if (!Number.isSafeInteger(max) || max < 0) {
		throw new Error(`Overlay ${kind} cap must be a non-negative integer.`);
	}
	const list = uniqueIds(ids);
	if (list.length > max) {
		throw new Error(`Overlay supports at most ${max} ${kind} (requested ${list.length}).`);
	}
	return list;
}

export function selectRichNodeIds(input: {
	hoveredIds: readonly string[];
	maxRichNodes: number;
	policy: RichNodePolicy;
	selectedIds: readonly string[];
}): string[] {
	if (!Number.isSafeInteger(input.maxRichNodes) || input.maxRichNodes < 0) {
		throw new Error("maxRichNodes must be a non-negative integer.");
	}
	const ordered =
		input.policy === "selected"
			? uniqueIds(input.selectedIds)
			: input.policy === "hovered"
				? uniqueIds([...input.hoveredIds, ...input.selectedIds])
				: uniqueIds([...input.selectedIds, ...input.hoveredIds]);
	return ordered.slice(0, input.maxRichNodes);
}
