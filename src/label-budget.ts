export interface LabelBudgetCandidate {
	id: string;
	importance: number;
	visible: boolean;
}

export interface SelectBudgetedLabelIdsInput {
	candidates: readonly LabelBudgetCandidate[];
	maxLabels: number;
}

/** Picks visible label ids by importance within a hard DOM budget. */
export function selectBudgetedLabelIds({ candidates, maxLabels }: SelectBudgetedLabelIdsInput): string[] {
	if (!Number.isSafeInteger(maxLabels) || maxLabels < 0) {
		throw new Error("maxLabels must be a non-negative integer.");
	}
	return candidates
		.filter((candidate) => candidate.visible)
		.sort((left, right) => {
			if (right.importance !== left.importance) return right.importance - left.importance;
			return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
		})
		.slice(0, maxLabels)
		.map((candidate) => candidate.id);
}

export interface SelectFocusLabelIdsInput {
	/** Prefer these ids first (selected, then hovered, then neighbors) — order within each tier is free. */
	focusIds: readonly string[];
	candidates: readonly LabelBudgetCandidate[];
	maxLabels: number;
	/**
	 * When `"importance"` (default), leftover budget is filled by visible importance.
	 * When `"none"`, only focus ids are labeled.
	 */
	fill?: "importance" | "none";
}

/**
 * Labels for a sparse focus set: keep focus ids that are visible, then optionally fill
 * remaining budget from other visible candidates by importance. Focus order is preserved.
 */
export function selectFocusLabelIds({
	focusIds,
	candidates,
	maxLabels,
	fill = "importance",
}: SelectFocusLabelIdsInput): string[] {
	if (!Number.isSafeInteger(maxLabels) || maxLabels < 0) {
		throw new Error("maxLabels must be a non-negative integer.");
	}
	const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
	const chosen: string[] = [];
	const chosenSet = new Set<string>();
	for (const id of focusIds) {
		if (chosen.length >= maxLabels) break;
		if (chosenSet.has(id)) continue;
		const candidate = byId.get(id);
		if (!candidate?.visible) continue;
		chosen.push(id);
		chosenSet.add(id);
	}
	if (fill === "none" || chosen.length >= maxLabels) return chosen;
	const fillers = selectBudgetedLabelIds({
		candidates: candidates.filter((candidate) => !chosenSet.has(candidate.id)),
		maxLabels: maxLabels - chosen.length,
	});
	return [...chosen, ...fillers];
}

/** Builds an ordered focus id list: selected, then hovered, then unique neighbors. */
export function orderFocusNodeIds(input: {
	selectedIds: readonly string[];
	hoveredIds: readonly string[];
	neighborIds: readonly string[];
}): string[] {
	const ordered: string[] = [];
	const seen = new Set<string>();
	for (const id of [...input.selectedIds, ...input.hoveredIds, ...input.neighborIds]) {
		if (seen.has(id)) continue;
		seen.add(id);
		ordered.push(id);
	}
	return ordered;
}
