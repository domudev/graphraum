import { describe, expect, test } from "vitest";
import { DEFAULT_FORCE_SETTINGS, forceIterationCount } from "../../../src/force-layout";
import { readExplorerForceControls } from "./explorer-force";

function form(entries: Record<string, string>): FormData {
	const values = new FormData();
	for (const [name, value] of Object.entries(entries)) values.set(name, value);
	return values;
}

describe("readExplorerForceControls", () => {
	test("maps gravity, repulsion, link distance, iterations, and batch size", () => {
		const controls = readExplorerForceControls(
			form({
				forceBatchSize: "250",
				forceGravity: "0.01",
				forceIterations: "16",
				forceLinkDistance: "48",
				forceRepulsion: "1000",
			}),
			1_000,
		);
		expect(controls).toEqual({
			batchSize: 250,
			iterations: 16,
			settings: {
				...DEFAULT_FORCE_SETTINGS,
				centerAttraction: 0.01,
				linkDistance: 48,
				repulsion: 1000,
			},
		});
	});

	test("uses size-based defaults when iterations and batch size are auto", () => {
		const controls = readExplorerForceControls(
			form({
				forceBatchSize: "auto",
				forceGravity: "0.002",
				forceIterations: "auto",
				forceLinkDistance: "24",
				forceRepulsion: "400",
			}),
			8_000,
		);
		expect(controls.iterations).toBe(forceIterationCount(8_000));
		expect(controls.batchSize).toBe(1_000);
	});
});
