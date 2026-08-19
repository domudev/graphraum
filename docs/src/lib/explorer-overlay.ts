import type { GraphraumOverlayNode, GraphraumOverlayOptions } from "../../../src/types";

export const EXPLORER_MAX_LABELS = 24;
export const EXPLORER_MAX_RICH_NODES = 1;

function renderLabel({ id, presentation }: GraphraumOverlayNode): HTMLElement {
	const label = document.createElement("span");
	label.textContent = presentation?.title ?? id;
	return label;
}

function renderToolbar(
	{ id, presentation }: GraphraumOverlayNode,
	onInspect?: (nodeId: string) => void,
): HTMLElement | null {
	if (!presentation?.actions.length) return null;
	const toolbar = document.createElement("div");
	for (const action of presentation.actions) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = action.label;
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			if (action.id === "inspect") onInspect?.(id);
		});
		toolbar.append(button);
	}
	return toolbar;
}

function renderRichNode({ id, presentation }: GraphraumOverlayNode): HTMLElement {
	const card = document.createElement("article");
	const title = document.createElement("strong");
	title.textContent = presentation?.title ?? id;
	const subtitle = document.createElement("span");
	subtitle.textContent = presentation?.subtitle ?? "GPU node · HTML focus";
	card.append(title, subtitle);
	return card;
}

/** Overlay contract for the fullscreen Explorer: sparse labels, selected toolbar, one rich card. */
export function createExplorerOverlayOptions(onInspect?: (nodeId: string) => void): GraphraumOverlayOptions {
	return {
		autoRichNodes: "selected",
		autoToolbar: "selected",
		labelClassName: "explorer-overlay-label",
		labelPolicy: "focus",
		maxLabels: EXPLORER_MAX_LABELS,
		maxRichNodes: EXPLORER_MAX_RICH_NODES,
		renderLabel,
		renderRichNode,
		renderToolbar: (node) => renderToolbar(node, onInspect),
		richNodeClassName: "explorer-overlay-rich",
		toolbarClassName: "explorer-overlay-toolbar",
	};
}
