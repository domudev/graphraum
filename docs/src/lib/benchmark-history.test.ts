import { describe, expect, it } from "vitest";
import { appendHistory, type BenchmarkHistoryEntry, metricValue, parseHistory } from "./benchmark-history";

const entry: BenchmarkHistoryEntry = {
	id: "run-1",
	timestamp: "2026-07-21T22:30:58.982Z",
	approach: "graphraum",
	mode: "2d",
	nodeCount: 100_000,
	edgeCount: 300_000,
	firstMeaningfulFrameMilliseconds: 395.4,
	frameP95Milliseconds: 9.3,
	selectionP95Milliseconds: 8.6,
	incrementalUpdateMilliseconds: 9.1,
	fullSnapshotUpdateMilliseconds: 383,
};

describe("benchmark history", () => {
	it("rejects corrupt or structurally incomplete persisted data", () => {
		expect(parseHistory("not json")).toEqual([]);
		expect(parseHistory(JSON.stringify([{ ...entry, nodeCount: "100000" }]))).toEqual([]);
	});

	it("retains only the newest bounded runs", () => {
		const entries = Array.from({ length: 3 }, (_, index) => ({ ...entry, id: `run-${index}` }));
		expect(appendHistory(entries, { ...entry, id: "run-3" }, 2).map((run) => run.id)).toEqual(["run-2", "run-3"]);
	});

	it("selects a comparable metric by key", () => {
		expect(metricValue(entry, "frameP95Milliseconds")).toBe(9.3);
		expect(metricValue(entry, "fullSnapshotUpdateMilliseconds")).toBe(383);
	});
});
