import { describe, expect, test } from "vitest";

import { resolveDocsVersion } from "./docs-version";

describe("docs version", () => {
	test("normalizes a semantic release tag into immutable references", () => {
		expect(resolveDocsVersion(" v0.4.0 ")).toEqual({
			display: "v0.4.0",
			installCommand: "bun add @domudev/graphraum@0.4.0",
			isRelease: true,
			referenceUrl: "https://github.com/domudev/graphraum/releases/tag/v0.4.0",
			sourceUrl: "https://github.com/domudev/graphraum/tree/v0.4.0",
		});
	});

	test("labels builds without a release tag as development", () => {
		expect(resolveDocsVersion()).toEqual({
			display: "development",
			installCommand: null,
			isRelease: false,
			referenceUrl: "https://github.com/domudev/graphraum",
			sourceUrl: "https://github.com/domudev/graphraum/tree/main",
		});
	});

	test("labels the automated main build as next without claiming a package release", () => {
		const revision = "0123456789abcdef0123456789abcdef01234567";
		expect(resolveDocsVersion("next", revision)).toEqual({
			display: "next",
			installCommand: null,
			isRelease: false,
			referenceUrl: `https://github.com/domudev/graphraum/commit/${revision}`,
			sourceUrl: `https://github.com/domudev/graphraum/tree/${revision}`,
		});
	});

	test("requires an immutable revision for next", () => {
		expect(() => resolveDocsVersion("next")).toThrow("Next documentation requires a full Git revision");
	});

	test("rejects a malformed supplied release tag", () => {
		expect(() => resolveDocsVersion("0.4")).toThrow('Invalid graphraum docs version: "0.4"');
	});
});
