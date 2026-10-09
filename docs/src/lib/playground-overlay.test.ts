import { describe, expect, test } from "vitest";
import { createPlaygroundOverlayOptions, PLAYGROUND_MAX_LABELS, PLAYGROUND_MAX_RICH_NODES } from "./playground-overlay";

describe("createPlaygroundOverlayOptions", () => {
	test("uses focus labels, selected toolbar, and one rich card", () => {
		const options = createPlaygroundOverlayOptions();
		expect(options.labelPolicy).toBe("focus");
		expect(options.autoToolbar).toBe("selected");
		expect(options.autoRichNodes).toBe("selected");
		expect(options.maxLabels).toBe(PLAYGROUND_MAX_LABELS);
		expect(options.maxRichNodes).toBe(PLAYGROUND_MAX_RICH_NODES);
		expect(options.renderLabel).toBeTypeOf("function");
		expect(options.renderToolbar).toBeTypeOf("function");
		expect(options.renderRichNode).toBeTypeOf("function");
	});
});
