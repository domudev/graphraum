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
