import { describe, expect, test } from "vitest";

import { sitePath } from "./site-path";

describe("sitePath", () => {
	test("adds the separator Astro's BASE_URL leaves out", () => {
		expect(sitePath("playground/", "/graphraum")).toBe("/graphraum/playground/");
		expect(sitePath("playground/", "/graphraum/v0.34.0/")).toBe("/graphraum/v0.34.0/playground/");
		expect(sitePath("", "/graphraum")).toBe("/graphraum/");
	});
});
