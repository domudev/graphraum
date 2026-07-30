import {
	defineVisuals,
	Graphraum,
	type GraphraumMode,
	type GraphraumNodeShape,
	type GraphraumNodeState,
	type GraphraumOptions,
	type GraphraumOverlay,
} from "../../src";

import {
	createFixture,
	type EdgeAttributes,
	type EdgeDistribution,
	type Encoding,
	type FixtureOptions,
	type NodeAttributes,
} from "./fixture";

type LayoutName = "circle" | "force" | "force-live" | "grid";
type LayoutWorkerMessage =
	| { end: number; positions: Float32Array; run: number; type: "positions" }
	| { run: number; type: "complete" };

interface LabState extends FixtureOptions {
	layoutBatchSize: number;
	forceCycles: number;
	forceRepulsion: number;
	forceDist: number;
	forceSpring: number;
	forceGravity: number;
	forceMaxFps: number;
	antialias: boolean;
	layout: LayoutName;
	maxPixelRatio: number;
	maxVisibleEdges: number;
	mode: GraphraumMode;
	nodeStates: Record<GraphraumNodeState, number>;
	theme: {
		background: string;
		dimmedNode: string;
		edge: string;
		focusedNode: string;
		hoveredNode: string;
		node: string;
		selectedNode: string;
	};
	viewportCulling: boolean;
	viewportOverscan: number;
}

function requireElement<ElementType extends Element>(selector: string) {
	const element = document.querySelector<ElementType>(selector);
	if (!element) throw new Error(`Laboratory element not found: ${selector}`);
	return element;
}

const container = requireElement<HTMLElement>("#graph");
const controls = requireElement<HTMLFormElement>("#controls");
const diagnostics = requireElement<HTMLElement>("#diagnostics");
const presentationActions = requireElement<HTMLElement>("#presentation-actions");
const presentationProperties = requireElement<HTMLElement>("#presentation-properties");
const presentationSubtitle = requireElement<HTMLElement>("#presentation-subtitle");
const presentationTitle = requireElement<HTMLElement>("#presentation-title");
const status = requireElement<HTMLElement>("#status");

function formValue(values: FormData, name: string) {
	const value = values.get(name);
	if (typeof value !== "string") throw new Error(`Missing laboratory control: ${name}`);
	return value;
}

function formNumber(values: FormData, name: string) {
	return Number(formValue(values, name));
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function clampInt(value: number, min: number, max: number) {
	return Math.round(clamp(value, min, max));
}

function nodeIndexFromId(nodeId: string, nodeCount: number) {
	if (!nodeId.startsWith("node-")) return -1;
	const index = Number(nodeId.slice(5));
	return Number.isSafeInteger(index) && index >= 0 && index < nodeCount ? index : -1;
}

function createForceEdges(nodeCount: number, edges: readonly { source: string; target: string }[]) {
	const candidate = new Uint32Array(edges.length * 2);
	let edgeCursor = 0;
	for (const edge of edges) {
		const sourceIndex = nodeIndexFromId(edge.source, nodeCount);
		const targetIndex = nodeIndexFromId(edge.target, nodeCount);
		if (sourceIndex < 0 || targetIndex < 0) continue;
		candidate[edgeCursor++] = sourceIndex;
		candidate[edgeCursor++] = targetIndex;
	}
	return edgeCursor === candidate.length ? candidate : candidate.slice(0, edgeCursor);
}

function layoutLabel(layout: LayoutName) {
	switch (layout) {
		case "circle":
			return "progressive circle";
		case "force-live":
			return "live force";
		case "force":
			return "force";
		default:
			return layout;
	}
}

function readState(): LabState {
	const values = new FormData(controls);
	return {
		forceGravity: clamp(formNumber(values, "forceGravity"), 0, 0.5),
		forceMaxFps: clampInt(formNumber(values, "forceMaxFps"), 1, 240),
		edgeDistribution: formValue(values, "edgeDistribution") as EdgeDistribution,
		forceCycles: clampInt(formNumber(values, "forceCycles"), 10, 5000),
		forceDist: clamp(formNumber(values, "forceDist"), 2, 512),
		forceSpring: clamp(formNumber(values, "forceSpring"), 0, 0.05),
		forceRepulsion: clamp(formNumber(values, "forceRepulsion"), 0.1, 1_000_000),
		layoutBatchSize: clampInt(formNumber(values, "layoutBatchSize"), 100, 4000),
		antialias: values.has("antialias"),
		edgeColors: {
			mentions: formValue(values, "mentionsColor"),
			related: formValue(values, "relatedColor"),
		},
		edgeMultiplier: formNumber(values, "edgeMultiplier"),
		encoding: formValue(values, "encoding") as Encoding,
		layout: formValue(values, "layout") as LayoutName,
		maxPixelRatio: formNumber(values, "maxPixelRatio"),
		maxVisibleEdges: formNumber(values, "maxVisibleEdges"),
		mode: formValue(values, "mode") as GraphraumMode,
		nodeStates: {
			dimmed: formNumber(values, "dimmedNodeIndex"),
			focused: formNumber(values, "focusedNodeIndex"),
			hovered: formNumber(values, "hoveredNodeIndex"),
			selected: formNumber(values, "selectedNodeIndex"),
		},
		nodeColors: {
			concept: formValue(values, "conceptColor"),
			document: formValue(values, "documentColor"),
			person: formValue(values, "personColor"),
		},
		nodeCount: formNumber(values, "nodeCount"),
		nodeShapes: {
			concept: formValue(values, "conceptShape") as GraphraumNodeShape,
			document: formValue(values, "documentShape") as GraphraumNodeShape,
			person: formValue(values, "personShape") as GraphraumNodeShape,
		},
		nodeSize: formNumber(values, "nodeSize"),
		scoreSize: formNumber(values, "scoreSize"),
		theme: {
			background: formValue(values, "background"),
			dimmedNode: formValue(values, "dimmedNode"),
			edge: formValue(values, "edge"),
			focusedNode: formValue(values, "focusedNode"),
			hoveredNode: formValue(values, "hoveredNode"),
			node: formValue(values, "node"),
			selectedNode: formValue(values, "selectedNode"),
		},
		viewportCulling: values.has("viewportCulling"),
		viewportOverscan: formNumber(values, "viewportOverscan"),
	};
}

let state = readState();
let graph: Graphraum<NodeAttributes, EdgeAttributes>;
let overlay: GraphraumOverlay<NodeAttributes, EdgeAttributes> | undefined;
let layoutRun = 0;
let updateCount = 0;
let activeLayoutRun = -1;
let dragNodeId: string | null = null;
let dragPointerId = -1;
const layoutWorker = new Worker(new URL("./layout-worker.ts", import.meta.url), { type: "module" });

const visuals = defineVisuals<NodeAttributes, EdgeAttributes>({
	node: (node) => ({
		presentation: {
			actions: [
				{ id: "focus", label: "Focus" },
				{ disabled: node.attributes.kind === "concept", id: "open", label: "Open source" },
			],
			properties: [
				{ id: "kind", label: "Kind", value: node.attributes.kind },
				{ id: "score", label: "Score", value: node.attributes.score },
				{ id: "theme", label: "Theme fallback", value: node.attributes.useTheme },
			],
			subtitle: `Typed ${node.attributes.kind} presentation`,
			title: `${node.attributes.kind} ${node.id}`,
		},
		...(state.encoding === "mapper"
			? {
					visual: {
						...(node.attributes.useTheme ? {} : { color: state.nodeColors[node.attributes.kind] }),
						shape: state.nodeShapes[node.attributes.kind],
						size: state.nodeSize + node.attributes.score * state.scoreSize,
					},
				}
			: {}),
	}),
	edge: (edge) => ({
		presentation: {
			properties: [
				{ id: "kind", label: "Kind", value: edge.attributes.kind },
				{ id: "theme", label: "Theme fallback", value: edge.attributes.useTheme },
			],
			title: `${edge.attributes.kind} ${edge.id}`,
		},
		...(state.encoding === "mapper" && !edge.attributes.useTheme
			? { visual: { color: state.edgeColors[edge.attributes.kind] } }
			: {}),
	}),
});

function renderEntries(element: HTMLElement, entries: ReadonlyArray<readonly [string, string | number]>) {
	element.replaceChildren(
		...entries.flatMap(([label, value]) => {
			const term = document.createElement("dt");
			term.textContent = label;
			const description = document.createElement("dd");
			description.textContent = String(value);
			return [term, description];
		}),
	);
}

function renderDiagnostics() {
	const values = graph.getDiagnostics();
	renderEntries(diagnostics, [
		["Draw calls", values.gpuDrawCalls],
		["LOD", values.lodLevel],
		["Picking", values.pickingStrategy],
		["Visible nodes", values.visibleNodes.toLocaleString()],
		["Edge candidates", values.visibleEdgeCandidates.toLocaleString()],
		["Visible edges", values.visibleEdges.toLocaleString()],
	]);
}

function renderPresentation(kind: "Edge" | "Node", id: string) {
	const presentation = kind === "Node" ? graph.getNodePresentation(id) : graph.getEdgePresentation(id);
	if (!presentation) return;
	presentationTitle.textContent = presentation.title;
	presentationSubtitle.textContent = presentation.subtitle ?? `Compiled ${kind.toLowerCase()} presentation`;
	renderEntries(
		presentationProperties,
		presentation.properties.map((property) => [`${property.label} · ${property.id}`, String(property.value)]),
	);
	presentationActions.replaceChildren(
		...presentation.actions.map((action) => {
			const button = document.createElement("button");
			button.disabled = action.disabled ?? false;
			button.textContent = `${action.label} · ${action.id}${action.disabled ? " · disabled" : ""}`;
			button.type = "button";
			return button;
		}),
	);
}

function labelNodeIds(selectedNodeId?: string) {
	return [
		...Array.from({ length: Math.min(state.nodeCount, 8) }, (_, index) => `node-${index}`),
		...(selectedNodeId ? [selectedNodeId] : []),
	];
}

function createOverlay() {
	overlay = graph.createOverlay({
		overlayClassName: "graphraum-overlay-host",
		labelClassName: "graph-label",
		toolbarClassName: "graph-action-toolbar",
		renderLabel: ({ id, presentation }) => {
			const label = document.createElement("span");
			label.textContent = presentation?.title ?? id;
			return label;
		},
		renderToolbar: ({ id, presentation }) => {
			if (!presentation) return null;
			const toolbar = document.createElement("div");
			toolbar.setAttribute("aria-label", `${presentation.title} actions`);
			for (const action of presentation.actions) {
				const button = document.createElement("button");
				button.disabled = action.disabled ?? false;
				button.textContent = action.label;
				button.type = "button";
				button.addEventListener("click", () => {
					status.textContent = `${action.label} requested for ${id}`;
					renderPresentation("Node", id);
				});
				toolbar.append(button);
			}
			return toolbar;
		},
	});
	overlay.setLabels(labelNodeIds());
}

function graphPositionForPointer(event: PointerEvent) {
	return graph.screenToWorld(event.clientX, event.clientY);
}

function pinDraggedNode(nodeId: string, event: PointerEvent) {
	const position = graphPositionForPointer(event);
	if (!position) return;
	graph.updateNodes([{ id: nodeId, position }]);
	const nodeIndex = nodeIndexFromId(nodeId, state.nodeCount);
	if (nodeIndex < 0) return;
	layoutWorker.postMessage({
		nodeIndex,
		position: [position.x, position.y, position.z],
		run: layoutRun,
		type: "pin-node",
	});
}

function unpinDraggedNode(nodeId: string) {
	const nodeIndex = nodeIndexFromId(nodeId, state.nodeCount);
	if (nodeIndex < 0) return;
	layoutWorker.postMessage({ nodeIndex, run: layoutRun, type: "unpin-node" });
}

function graphOptions(): GraphraumOptions<NodeAttributes, EdgeAttributes> {
	return {
		antialias: state.antialias,
		maxPixelRatio: state.maxPixelRatio,
		maxVisibleEdges: state.maxVisibleEdges,
		mode: state.mode,
		theme: state.theme,
		viewportCulling: state.viewportCulling,
		viewportOverscan: state.viewportOverscan,
		visuals,
	};
}

function applyLayoutProgressively(layout: LayoutName, forceEdges?: Uint32Array) {
	const run = ++layoutRun;
	status.textContent = `Computing ${layoutLabel(layout)} layout in worker`;
	const useForce = layout === "force" || layout === "force-live";
	const transferable: Transferable[] = [];
	if (useForce && forceEdges) {
		transferable.push(forceEdges.buffer);
	}
	layoutWorker.postMessage(
		{
			batchSize: state.layoutBatchSize,
			layout,
			nodeCount: state.nodeCount,
			run,
			...(useForce && forceEdges
				? {
						forceCycles: state.forceCycles,
						forceDist: state.forceDist,
						forceSpring: state.forceSpring,
						edges: forceEdges,
						forceGravity: state.forceGravity,
						forceRepulsion: state.forceRepulsion,
						...(layout === "force-live" ? { maxFps: state.forceMaxFps } : {}),
					}
				: {}),
			type: "start",
		},
		transferable,
	);
}

layoutWorker.addEventListener("message", ({ data }: MessageEvent<LayoutWorkerMessage>) => {
	if (data.run !== layoutRun) return;
	if (data.type === "positions") {
		const start = data.end - data.positions.length / 3;
		const nodeIds = Array.from({ length: data.positions.length / 3 }, (_, index) => `node-${start + index}`);
		graph.applyLayout({ nodeIds, positions: data.positions });
		if (activeLayoutRun !== data.run) {
			if (data.end === state.nodeCount) {
				graph.fitView();
				activeLayoutRun = data.run;
			}
		}
		status.textContent = `Applying ${layoutLabel(state.layout)} layout · ${data.end.toLocaleString()} / ${state.nodeCount.toLocaleString()} nodes`;
		if (state.layout !== "force-live") {
			requestAnimationFrame(() => {
				if (data.run === layoutRun) layoutWorker.postMessage({ run: data.run, type: "next" });
			});
		}
		return;
	}
	graph.fitView();
	activeLayoutRun = -1;
	const encoding = state.encoding === "mapper" ? "typed mapper" : "direct snapshot";
	status.textContent = `${state.nodeCount.toLocaleString()} nodes · ${(state.nodeCount * state.edgeMultiplier).toLocaleString()} edges · ${state.mode.toUpperCase()} · ${encoding} · ${layoutLabel(state.layout)}`;
	requestAnimationFrame(renderDiagnostics);
});

window.addEventListener("beforeunload", () => layoutWorker.terminate());

function rebuild() {
	layoutRun += 1;
	state = readState();
	activeLayoutRun = -1;
	overlay?.destroy();
	graph?.destroy();
	graph = new Graphraum<NodeAttributes, EdgeAttributes>(container, graphOptions());
	const data = createFixture(state);
	graph.setData(data);
	for (const [nodeState, index] of Object.entries(state.nodeStates) as [GraphraumNodeState, number][]) {
		graph.setNodeState(nodeState, index >= 0 && index < state.nodeCount ? [`node-${index}`] : []);
	}
	createOverlay();
	const encodingLabel = state.encoding === "mapper" ? "typed mapper" : "direct snapshot";
	status.textContent = `${state.nodeCount.toLocaleString()} nodes · ${(state.nodeCount * state.edgeMultiplier).toLocaleString()} edges · ${state.mode.toUpperCase()} · ${encodingLabel}`;
	presentationTitle.textContent = "Select a node";
	presentationSubtitle.textContent = "Compiled metadata appears here.";
	presentationProperties.replaceChildren();
	presentationActions.replaceChildren();
	requestAnimationFrame(renderDiagnostics);
	if (state.layout !== "grid") {
		const forceEdges =
			state.layout === "force" || state.layout === "force-live"
				? createForceEdges(state.nodeCount, data.edges)
				: undefined;
		applyLayoutProgressively(state.layout, forceEdges);
	}
	dragNodeId = null;
	dragPointerId = -1;
}

controls.addEventListener("change", rebuild);

container.addEventListener("click", (event) => {
	if (dragNodeId !== null) {
		dragNodeId = null;
		return;
	}
	const selectedNode = graph.pick(event.clientX, event.clientY);
	graph.setSelection(selectedNode ? [selectedNode] : []);
	overlay?.setLabels(labelNodeIds(selectedNode ?? undefined));
	overlay?.setToolbar(selectedNode);
	if (selectedNode) renderPresentation("Node", selectedNode);
	requestAnimationFrame(renderDiagnostics);
});

for (const eventName of ["wheel"]) {
	container.addEventListener(eventName, () => requestAnimationFrame(renderDiagnostics));
}

container.addEventListener("pointerdown", (event) => {
	const selectedNode = graph.pick(event.clientX, event.clientY);
	if (!selectedNode) return;
	if (state.layout !== "force-live") {
		graph.setSelection([selectedNode]);
		overlay?.setLabels(labelNodeIds(selectedNode));
		overlay?.setToolbar(selectedNode);
		renderPresentation("Node", selectedNode);
		requestAnimationFrame(renderDiagnostics);
		return;
	}
	event.preventDefault();
	dragNodeId = selectedNode;
	dragPointerId = event.pointerId;
	graph.setSelection([selectedNode]);
	overlay?.setLabels(labelNodeIds(selectedNode));
	overlay?.setToolbar(selectedNode);
	renderPresentation("Node", selectedNode);
	pinDraggedNode(selectedNode, event);
	requestAnimationFrame(renderDiagnostics);
	if (container.hasPointerCapture(event.pointerId)) return;
	container.setPointerCapture(event.pointerId);
});

container.addEventListener("pointermove", (event) => {
	if (dragNodeId === null || event.pointerId !== dragPointerId || state.layout !== "force-live") return;
	pinDraggedNode(dragNodeId, event);
});

container.addEventListener("pointercancel", () => {
	if (dragNodeId !== null) {
		unpinDraggedNode(dragNodeId);
		dragNodeId = null;
	}
	dragPointerId = -1;
	requestAnimationFrame(renderDiagnostics);
});

container.addEventListener("pointerup", (event) => {
	if (dragNodeId !== null && event.pointerId === dragPointerId) {
		unpinDraggedNode(dragNodeId);
		if (container.hasPointerCapture(dragPointerId)) container.releasePointerCapture(dragPointerId);
		dragNodeId = null;
		dragPointerId = -1;
	}
	requestAnimationFrame(renderDiagnostics);
});

requireElement<HTMLButtonElement>("#fit").addEventListener("click", () => {
	graph.fitView();
	requestAnimationFrame(renderDiagnostics);
});

requireElement<HTMLButtonElement>("#inspect-edge").addEventListener("click", () => {
	renderPresentation("Edge", "edge-0");
});

requireElement<HTMLButtonElement>("#update-node").addEventListener("click", () => {
	updateCount += 1;
	graph.updateNodes([
		{
			color: updateCount % 2 === 0 ? state.nodeColors.concept : "#ff4d8d",
			id: "node-0",
			position: { x: updateCount % 2 === 0 ? 0 : 24, y: 0, z: 0 },
			shape: updateCount % 2 === 0 ? state.nodeShapes.concept : "square",
			size: updateCount % 2 === 0 ? state.nodeSize : state.nodeSize * 2,
		},
	]);
	graph.setSelection(["node-0"]);
	overlay?.setLabels(labelNodeIds("node-0"));
	overlay?.setToolbar("node-0");
	renderPresentation("Node", "node-0");
	requestAnimationFrame(renderDiagnostics);
});

rebuild();
