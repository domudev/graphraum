import { DEFAULT_FORCE_SETTINGS, type ForceSettings, forceIterationCount } from "../../../src/force-layout";

export interface PlaygroundForceControls {
	batchSize: number;
	iterations: number;
	settings: ForceSettings;
}

function requiredNumber(values: FormData, name: string): number {
	const raw = values.get(name);
	if (typeof raw !== "string") throw new Error(`Missing playground control: ${name}`);
	const value = Number(raw);
	if (!Number.isFinite(value)) throw new Error(`Invalid playground control: ${name}`);
	return value;
}

/** Reads playground force fields. `auto` iterations and batch size follow the current graph size. */
export function readPlaygroundForceControls(values: FormData, nodeCount: number): PlaygroundForceControls {
	const iterationsRaw = values.get("forceIterations");
	const batchRaw = values.get("forceBatchSize");
	const iterations =
		iterationsRaw === "auto" || iterationsRaw === null
			? forceIterationCount(nodeCount)
			: requiredNumber(values, "forceIterations");
	const batchSize =
		batchRaw === "auto" || batchRaw === null
			? Math.max(1_000, Math.ceil(nodeCount / 8))
			: requiredNumber(values, "forceBatchSize");
	return {
		batchSize,
		iterations,
		settings: {
			...DEFAULT_FORCE_SETTINGS,
			centerAttraction: requiredNumber(values, "forceGravity"),
			linkDistance: requiredNumber(values, "forceLinkDistance"),
			repulsion: requiredNumber(values, "forceRepulsion"),
		},
	};
}
