import { describe, expect, test } from "vitest";

import {
	createReleaseFallback,
	createRootRedirect,
	createVersionArchive,
	createVersionManifest,
	injectVersionNavigation,
	parseReleaseTags,
	type ReleaseMetadata,
} from "./release-archive";

const releases: readonly ReleaseMetadata[] = [
	{
		publishedAt: "2026-07-23T20:00:00+02:00",
		revision: "0123456789abcdef0123456789abcdef01234567",
		summary: "feat(renderer): batch built-in node shapes",
		version: "v0.5.0",
	},
	{
		publishedAt: "2026-07-22T20:00:00+02:00",
		revision: "89abcdef0123456789abcdef0123456789abcdef",
		summary: "feat(sdk): compile typed graph presentations",
		version: "v0.4.0",
	},
];

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

	test("adds release metadata and navigation hints to the manifest", () => {
		const manifest = JSON.parse(createVersionManifest(releases, releases[0]));

		expect(manifest.latest).toBe("v0.5.0");
		expect(manifest.archiveHref).toBe("/graphraum/versions/");
		expect(manifest.selectorVersions).toEqual(["v0.5.0", "v0.4.0"]);
		expect(manifest.versions[0]).toMatchObject({
			channel: "development",
			version: "next",
		});
		expect(manifest.versions[1]).toMatchObject({
			channel: "latest",
			publishedAt: "2026-07-23T20:00:00+02:00",
			summary: "feat(renderer): batch built-in node shapes",
			version: "v0.5.0",
		});
	});

	test("limits the header selector to the latest ten stable releases", () => {
		const manyReleases = Array.from({ length: 12 }, (_, index) => ({
			...releases[0],
			version: `v0.${12 - index}.0`,
		}));
		const manifest = JSON.parse(createVersionManifest(manyReleases, releases[0]));

		expect(manifest.selectorVersions).toHaveLength(10);
		expect(manifest.selectorVersions.at(0)).toBe("v0.12.0");
		expect(manifest.selectorVersions.at(-1)).toBe("v0.3.0");
		expect(manifest.versions).toHaveLength(13);
	});

	test("renders every stable release with date, metadata, and links", () => {
		const html = createVersionArchive(releases);

		expect(html).toContain("Documentation versions");
		expect(html).toContain("v0.5.0");
		expect(html).toContain("2026-07-23");
		expect(html).toContain("batch built-in node shapes");
		expect(html).toContain("/graphraum/v0.4.0/");
		expect(html).toContain("/releases/tag/v0.4.0");
		expect(html).toContain("/tree/v0.4.0");
	});

	test("rejects a mutable or malformed next revision", () => {
		expect(() => createVersionManifest(releases, { ...releases[0], revision: "main" })).toThrow("full Git revision");
	});
});
