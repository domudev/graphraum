export const BENCHMARK_HISTORY_STORAGE_KEY = "graphraum:benchmark-history:v1";

export type BenchmarkHistoryMetric =
	| "firstMeaningfulFrameMilliseconds"
	| "frameP95Milliseconds"
	| "selectionP95Milliseconds"
	| "incrementalUpdateMilliseconds"
	| "fullSnapshotUpdateMilliseconds";

export interface BenchmarkHistoryEntry {
	id: string;
	timestamp: string;
	approach: string;
	mode: "2d" | "3d";
	nodeCount: number;
	edgeCount: number;
	firstMeaningfulFrameMilliseconds: number;
	frameP95Milliseconds: number;
	selectionP95Milliseconds: number;
	incrementalUpdateMilliseconds: number;
	fullSnapshotUpdateMilliseconds: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isHistoryEntry(value: unknown): value is BenchmarkHistoryEntry {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === "string" &&
		typeof value.timestamp === "string" &&
		typeof value.approach === "string" &&
		(value.mode === "2d" || value.mode === "3d") &&
		typeof value.nodeCount === "number" &&
		typeof value.edgeCount === "number" &&
		typeof value.firstMeaningfulFrameMilliseconds === "number" &&
		typeof value.frameP95Milliseconds === "number" &&
		typeof value.selectionP95Milliseconds === "number" &&
		typeof value.incrementalUpdateMilliseconds === "number" &&
		typeof value.fullSnapshotUpdateMilliseconds === "number"
	);
}

export function parseHistory(raw: string | null): BenchmarkHistoryEntry[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
	} catch {
		return [];
	}
}

export function appendHistory(
	entries: BenchmarkHistoryEntry[],
	entry: BenchmarkHistoryEntry,
	limit = 60,
): BenchmarkHistoryEntry[] {
	return [...entries, entry].slice(-limit);
}

export function metricValue(entry: BenchmarkHistoryEntry, metric: BenchmarkHistoryMetric): number {
	return entry[metric];
}
