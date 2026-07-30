import type { Graphraum } from "./graphraum";
import type { CompiledGraphraumPresentation, GraphraumOverlayNode, GraphraumOverlayOptions } from "./types";

type OverlayEntry = {
	element: HTMLElement;
	presentation: CompiledGraphraumPresentation | null;
};

function assertElement(element: HTMLElement | null, kind: string) {
	if (element !== null && !(element instanceof HTMLElement)) {
		throw new Error(`${kind} renderer must return an HTMLElement or null`);
	}
}

/** A bounded DOM layer for labels and a focused-node toolbar. It never participates in WebGL rendering. */
export class GraphraumOverlay<NodeAttributes = undefined, EdgeAttributes = undefined> {
	private readonly root = document.createElement("div");
	private readonly labels = new Map<string, OverlayEntry>();
	private toolbar: OverlayEntry | null = null;
	private toolbarNodeId: string | null = null;
	private readonly stopObserving: () => void;
	private readonly previousContainerPosition: string | null;

	constructor(
		private readonly graph: Graphraum<NodeAttributes, EdgeAttributes>,
		private readonly container: HTMLElement,
		private readonly options: GraphraumOverlayOptions,
	) {
		const maxLabels = options.maxLabels ?? 50;
		if (!Number.isSafeInteger(maxLabels) || maxLabels < 0) {
			throw new Error("Overlay maxLabels must be a non-negative integer.");
		}
		this.root.className = "graphraum-overlay";
		this.root.style.cssText = "inset:0;pointer-events:none;position:absolute;";
		this.previousContainerPosition =
			getComputedStyle(this.container).position === "static" ? this.container.style.position : null;
		if (this.previousContainerPosition !== null) this.container.style.position = "relative";
		this.container.append(this.root);
		this.stopObserving = graph.onViewChange(() => this.update());
	}

	setLabels(nodeIds: Iterable<string>) {
		const nodeIdList = [...new Set(nodeIds)];
		const maxLabels = this.options.maxLabels ?? 50;
		if (nodeIdList.length > maxLabels) throw new Error(`Overlay supports at most ${maxLabels} labels.`);
		for (const entry of this.labels.values()) entry.element.remove();
		this.labels.clear();
		for (const nodeId of nodeIdList) {
			const entry = this.createEntry(nodeId, this.options.renderLabel, "Label", "none");
			if (entry) this.labels.set(nodeId, entry);
		}
		this.update();
	}

	setToolbar(nodeId: string | null) {
		this.toolbar?.element.remove();
		this.toolbar = null;
		this.toolbarNodeId = nodeId;
		if (nodeId !== null) this.toolbar = this.createEntry(nodeId, this.options.renderToolbar, "Toolbar", "auto");
		this.update();
	}

	destroy() {
		this.stopObserving();
		this.root.remove();
		if (this.previousContainerPosition !== null && this.container.querySelector(".graphraum-overlay") === null)
			this.container.style.position = this.previousContainerPosition;
		this.labels.clear();
		this.toolbar = null;
	}

	private createEntry(
		nodeId: string,
		render: ((node: GraphraumOverlayNode) => HTMLElement | null) | undefined,
		kind: string,
		pointerEvents: "auto" | "none",
	): OverlayEntry | null {
		if (!render || !this.graph.getNodeScreenPosition(nodeId)) return null;
		const presentation = this.graph.getNodePresentation(nodeId);
		const element = render({ id: nodeId, presentation });
		assertElement(element, kind);
		if (!element) return null;
		element.dataset.graphraumNodeId = nodeId;
		element.style.position = "absolute";
		element.style.pointerEvents = pointerEvents;
		this.root.append(element);
		return { element, presentation };
	}

	private update() {
		for (const [nodeId, entry] of this.labels)
			this.updateEntry(nodeId, entry, this.options.renderLabel, "label", "none");
		if (this.toolbar && this.toolbarNodeId)
			this.updateEntry(this.toolbarNodeId, this.toolbar, this.options.renderToolbar, "toolbar", "auto");
	}

	private updateEntry(
		nodeId: string,
		entry: OverlayEntry,
		render: ((node: GraphraumOverlayNode) => HTMLElement | null) | undefined,
		kind: "label" | "toolbar",
		pointerEvents: "auto" | "none",
	) {
		const position = this.graph.getNodeScreenPosition(nodeId);
		entry.element.hidden = !position?.visible;
		if (!position?.visible) return;
		entry.element.style.transform = `translate(${position.x}px, ${position.y}px) translate(-50%, -100%)`;
		const presentation = this.graph.getNodePresentation(nodeId);
		if (presentation === entry.presentation || !render) return;
		const replacement = render({ id: nodeId, presentation });
		assertElement(replacement, `${kind[0].toUpperCase()}${kind.slice(1)}`);
		if (!replacement) {
			entry.element.remove();
			if (kind === "toolbar") this.toolbar = null;
			else this.labels.delete(nodeId);
			return;
		}
		replacement.dataset.graphraumNodeId = nodeId;
		replacement.style.cssText = `${entry.element.style.cssText};position:absolute;pointer-events:${pointerEvents};`;
		entry.element.replaceWith(replacement);
		entry.element = replacement;
		entry.presentation = presentation;
	}
}
