import type { GraphraumMode } from "../../../src/types";

/** Headline numbers from one Prove run, in milliseconds except draw calls. */
export interface ProveMeasures {
	drawCalls: number;
	firstFrame: number;
	frameP50: number;
	frameP95: number;
	fullSnapshot: number;
	incrementalUpdate: number;
	selectionP95: number;
}

export interface ProveRow {
	label: string;
	reference: string;
	you: string;
	/** True when this device beat the reference on a lower-is-better measure. */
	faster: boolean;
}

/** Reference run for 100k nodes and 300k edges, published in graphraum issue #14. */
export const PROVE_REFERENCE_NODE_COUNT = 100_000;
export const PROVE_REFERENCE_CONTEXT = "Chrome 150 on macOS, pixel ratio 1, captured 21 July 2026";

export const proveReference: Record<GraphraumMode, ProveMeasures> = {
	"2d": {
		drawCalls: 2,
		firstFrame: 395.4,
		frameP50: 8.4,
		frameP95: 9.3,
		fullSnapshot: 383.0,
		incrementalUpdate: 9.1,
		selectionP95: 8.6,
	},
	"3d": {
		drawCalls: 2,
		firstFrame: 305.3,
		frameP50: 8.3,
		frameP95: 9.3,
		fullSnapshot: 313.8,
		incrementalUpdate: 10.2,
		selectionP95: 9.0,
	},
};

const rowSpecs = [
	{ key: "firstFrame", label: "First frame" },
	{ key: "frameP50", label: "Median frame" },
	{ key: "frameP95", label: "Frame p95" },
	{ key: "selectionP95", label: "Selection p95" },
	{ key: "incrementalUpdate", label: "1% update" },
	{ key: "fullSnapshot", label: "Full snapshot +1%" },
	{ key: "drawCalls", label: "Draw calls" },
] as const satisfies readonly { key: keyof ProveMeasures; label: string }[];

export function formatMilliseconds(value: number): string {
	return `${value < 100 ? value.toFixed(1) : Math.round(value)} ms`;
}

function format(key: keyof ProveMeasures, value: number | undefined): string {
	if (value === undefined) return "-";
	return key === "drawCalls" ? String(value) : formatMilliseconds(value);
}

/** Rows for the Prove panel. The reference column only applies to the 100k fixture. */
export function proveRows(you: ProveMeasures | null, mode: GraphraumMode, nodeCount: number): readonly ProveRow[] {
	const reference = nodeCount === PROVE_REFERENCE_NODE_COUNT ? proveReference[mode] : null;
	return rowSpecs.map(({ key, label }) => {
		const mine = you?.[key];
		const theirs = reference?.[key];
		return {
			faster: key !== "drawCalls" && mine !== undefined && theirs !== undefined && mine < theirs,
			label,
			reference: format(key, theirs),
			you: format(key, mine),
		};
	});
}
