import { describe, expect, test } from "vitest";

import { legacyRedirects, legacyTarget } from "./legacy-redirects";

describe("legacy redirects", () => {
	test("keeps the version base, with or without a trailing slash", () => {
		expect(legacyTarget("explore", "/graphraum/v0.34.0")).toBe("/graphraum/v0.34.0/playground/?scene=stress");
		expect(legacyTarget("api-reference", "/graphraum/")).toBe("/graphraum/reference/api/");
	});

	test("sends every demo and proof route to the playground", () => {
		for (const route of [
			"benchmark",
			"demos",
			"demos/dependencies",
			"demos/investigation",
			"demos/knowledge",
			"explore",
		] as const) {
			expect(legacyRedirects[route].startsWith("playground/")).toBe(true);
		}
	});
});
