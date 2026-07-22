import { describe, expect, test } from "vitest";

import {
	createReleaseFallback,
	createRootRedirect,
	createVersionManifest,
	injectVersionNavigation,
	parseReleaseTags,
} from "./release-archive";

describe("release archive", () => {
	test("sorts stable semantic release tags newest first", () => {
		expect(parseReleaseTags("v0.2.2\nv0.10.0\nnot-a-release\nv0.2.0\nv1.0.0-beta.1\n")).toEqual([
			"v0.10.0",
			"v0.2.2",
			"v0.2.0",
		]);
	});

	test("injects shared version navigation once", () => {
		const html = "<!doctype html><html><head><title>Docs</title></head><body>Graphraum</body></html>";
		const injected = injectVersionNavigation(html);

		expect(injected).toContain('href="/graphraum/version-selector.css"');
		expect(injected).toContain('src="/graphraum/version-selector.js"');
		expect(injectVersionNavigation(injected)).toBe(injected);
	});

	test("creates an honest fallback for releases without docs", () => {
		const html = createReleaseFallback("v0.1.0");

		expect(html).toContain("Documentation was not shipped with this release");
		expect(html).toContain("/releases/tag/v0.1.0");
		expect(html).toContain("/tree/v0.1.0");
	});

	test("redirects latest aliases to the immutable release path", () => {
		expect(createRootRedirect("v0.4.0", "api-reference/")).toContain("/graphraum/v0.4.0/api-reference/");
	});

	test("generates selector metadata from the release tags", () => {
		expect(JSON.parse(createVersionManifest(["v0.4.0", "v0.3.0"]))).toEqual({
			latest: "v0.4.0",
			versions: [
				{
					href: "/graphraum/v0.4.0/",
					releaseNotes: "https://github.com/domudev/graphraum/releases/tag/v0.4.0",
					version: "v0.4.0",
				},
				{
					href: "/graphraum/v0.3.0/",
					releaseNotes: "https://github.com/domudev/graphraum/releases/tag/v0.3.0",
					version: "v0.3.0",
				},
			],
		});
	});
});
