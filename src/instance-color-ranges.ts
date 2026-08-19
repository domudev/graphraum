/** Minimal attribute surface used for dirty GPU color uploads. */
export interface UpdateRangeAttribute {
	addUpdateRange(start: number, count: number): void;
	clearUpdateRanges(): void;
	needsUpdate: boolean;
}

/**
 * Marks RGB update ranges for visible instance slots.
 * Returns how many slots were marked.
 */
export function markInstanceColorSlots(attribute: UpdateRangeAttribute, slots: Iterable<number>): number {
	attribute.clearUpdateRanges();
	let count = 0;
	for (const slot of slots) {
		if (!Number.isSafeInteger(slot) || slot < 0) continue;
		attribute.addUpdateRange(slot * 3, 3);
		count += 1;
	}
	if (count > 0) attribute.needsUpdate = true;
	return count;
}
