import { describe, expect, test } from "vitest";

import { formatMilliseconds, proveReference, proveRows } from "./prove-reference";

const measured = {
	drawCalls: 2,
	firstFrame: 372,
	frameP50: 8.9,
	frameP95: 12.4,
	fullSnapshot: 401,
	incrementalUpdate: 8.7,
	selectionP95: 9.1,
};

describe("proveRows", () => {
	test("compares a 100k run with the reference for the same mode", () => {
		const rows = proveRows(measured, "2d", 100_000);

		expect(rows.map(({ label }) => label)).toEqual([
			"First frame",
			"Median frame",
			"Frame p95",
			"Selection p95",
			"1% update",
			"Full snapshot +1%",
			"Draw calls",
		]);
		expect(rows[0]).toEqual({ faster: true, label: "First frame", reference: "395 ms", you: "372 ms" });
		expect(rows[2]).toMatchObject({ faster: false, reference: "9.3 ms", you: "12.4 ms" });
		expect(rows[6]).toEqual({ faster: false, label: "Draw calls", reference: "2", you: "2" });
	});

	test("uses the 3D reference in 3D", () => {
		expect(proveRows(measured, "3d", 100_000)[0]?.reference).toBe(formatMilliseconds(proveReference["3d"].firstFrame));
	});

	test("leaves the reference empty for sizes it was not measured at", () => {
		const rows = proveRows(measured, "2d", 10_000);

		expect(rows.every(({ reference }) => reference === "-")).toBe(true);
		expect(rows.every(({ faster }) => !faster)).toBe(true);
	});

	test("shows dashes before a run", () => {
		expect(proveRows(null, "2d", 100_000).every(({ you }) => you === "-")).toBe(true);
	});
});
