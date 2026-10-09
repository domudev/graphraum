/** Minimal attribute surface used for dirty GPU color uploads. */
export interface UpdateRangeAttribute {
	addUpdateRange(start: number, count: number): void;
	needsUpdate: boolean;
}

/**
 * Marks RGB update ranges for visible instance slots.
 * Keeps earlier ranges that have not been uploaded yet (a viewport materialize in the same frame);
 * three.js merges and clears ranges on upload.
 * Returns how many slots were marked.
 */
export function markInstanceColorSlots(attribute: UpdateRangeAttribute, slots: Iterable<number>): number {
	let count = 0;
	for (const slot of slots) {
		if (!Number.isSafeInteger(slot) || slot < 0) continue;
		attribute.addUpdateRange(slot * 3, 3);
		count += 1;
	}
	if (count > 0) attribute.needsUpdate = true;
	return count;
}
