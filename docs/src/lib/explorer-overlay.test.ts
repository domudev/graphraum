import { describe, expect, test } from "vitest";
import { createExplorerOverlayOptions, EXPLORER_MAX_LABELS, EXPLORER_MAX_RICH_NODES } from "./explorer-overlay";

describe("createExplorerOverlayOptions", () => {
	test("uses focus labels, selected toolbar, and one rich card", () => {
		const options = createExplorerOverlayOptions();
		expect(options.labelPolicy).toBe("focus");
		expect(options.autoToolbar).toBe("selected");
		expect(options.autoRichNodes).toBe("selected");
		expect(options.maxLabels).toBe(EXPLORER_MAX_LABELS);
		expect(options.maxRichNodes).toBe(EXPLORER_MAX_RICH_NODES);
		expect(options.renderLabel).toBeTypeOf("function");
		expect(options.renderToolbar).toBeTypeOf("function");
		expect(options.renderRichNode).toBeTypeOf("function");
	});
});
