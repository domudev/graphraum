import {
	defineVisuals,
	Graphraum,
	type GraphraumData,
	type GraphraumMode,
	type GraphraumNodeShape,
	type GraphraumOptions,
} from "../../src";

// Three playground layouts, switchable with ?variant=a|b|c on the existing benchmark route.

type NodeKind = "concept" | "document" | "person";
type EdgeKind = "mentions" | "related";

type NodeAttributes = {
	kind: NodeKind;
	score: number;
};

type EdgeAttributes = {
	kind: EdgeKind;
};

type Encoding = "mapper" | "snapshot";
type Variant = "a" | "b" | "c";

interface LabState {
	antialias: boolean;
	edgeMultiplier: number;
	encoding: Encoding;
	maxPixelRatio: number;
	maxVisibleEdges: number;
	mode: GraphraumMode;
	nodeColors: Record<NodeKind, string>;
	nodeCount: number;
	nodeShapes: Record<NodeKind, GraphraumNodeShape>;
	nodeSize: number;
	scoreSize: number;
	theme: {
		background: string;
		edge: string;
		node: string;
		selectedNode: string;
	};
	viewportCulling: boolean;
	viewportOverscan: number;
	edgeColors: Record<EdgeKind, string>;
}

const nodeKinds = ["concept", "document", "person"] as const;
const variants = [
	{ id: "a", name: "Sidebar studio" },
	{ id: "b", name: "Control deck" },
	{ id: "c", name: "Canvas HUD" },
] as const;

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
const variantLabel = requireElement<HTMLElement>("#variant-label");

function formValue(values: FormData, name: string) {
	const value = values.get(name);
	if (typeof value !== "string") throw new Error(`Missing laboratory control: ${name}`);
	return value;
}

function formNumber(values: FormData, name: string) {
	return Number(formValue(values, name));
}

function readState(): LabState {
	const values = new FormData(controls);
	return {
		antialias: values.has("antialias"),
		edgeColors: {
			mentions: formValue(values, "mentionsColor"),
			related: formValue(values, "relatedColor"),
		},
		edgeMultiplier: formNumber(values, "edgeMultiplier"),
		encoding: formValue(values, "encoding") as Encoding,
		maxPixelRatio: formNumber(values, "maxPixelRatio"),
		maxVisibleEdges: formNumber(values, "maxVisibleEdges"),
		mode: formValue(values, "mode") as GraphraumMode,
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
			edge: formValue(values, "edge"),
			node: formValue(values, "node"),
			selectedNode: formValue(values, "selectedNode"),
		},
		viewportCulling: values.has("viewportCulling"),
		viewportOverscan: formNumber(values, "viewportOverscan"),
	};
}

let state = readState();
let graph: Graphraum<NodeAttributes, EdgeAttributes>;
let updateCount = 0;

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
			],
			subtitle: `Typed ${node.attributes.kind} presentation`,
			title: `${node.attributes.kind} ${node.id}`,
		},
		...(state.encoding === "mapper"
			? {
					visual: {
						color: state.nodeColors[node.attributes.kind],
						shape: state.nodeShapes[node.attributes.kind],
						size: state.nodeSize + node.attributes.score * state.scoreSize,
					},
				}
			: {}),
	}),
	edge: (edge) => ({
		presentation: {
			properties: [{ id: "kind", label: "Kind", value: edge.attributes.kind }],
			title: `${edge.attributes.kind} ${edge.id}`,
		},
		...(state.encoding === "mapper" ? { visual: { color: state.edgeColors[edge.attributes.kind] } } : {}),
	}),
});

function fixture(): GraphraumData<NodeAttributes, EdgeAttributes> {
	const edgeCount = state.nodeCount * state.edgeMultiplier;
	const columns = Math.ceil(Math.sqrt(state.nodeCount));
	const nodes = Array.from({ length: state.nodeCount }, (_, index) => {
		const kind = nodeKinds[index % nodeKinds.length];
		const score = (index % 5) / 5;
		return {
			attributes: { kind, score },
			...(state.encoding === "snapshot"
				? {
						color: state.nodeColors[kind],
						shape: state.nodeShapes[kind],
						size: state.nodeSize + score * state.scoreSize,
					}
				: {}),
			id: `node-${index}`,
			position: {
				x: (index % columns) * 12,
				y: Math.floor(index / columns) * 12,
				z: ((index * 17) % 101) - 50,
			},
		};
	});
	const edges = Array.from({ length: edgeCount }, (_, index) => {
		const kind: EdgeKind = index % 4 === 0 ? "mentions" : "related";
		return {
			attributes: { kind },
			...(state.encoding === "snapshot" ? { color: state.edgeColors[kind] } : {}),
			id: `edge-${index}`,
			source: `node-${index % state.nodeCount}`,
			target: `node-${(index * 97 + 13) % state.nodeCount}`,
		};
	});
	return { edges, nodes };
}

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
		presentation.properties.map((property) => [property.label, String(property.value)]),
	);
	presentationActions.replaceChildren(
		...presentation.actions.map((action) => {
			const button = document.createElement("button");
			button.disabled = action.disabled ?? false;
			button.textContent = action.label;
			button.type = "button";
			return button;
		}),
	);
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

function rebuild() {
	state = readState();
	graph?.destroy();
	const startedAt = performance.now();
	graph = new Graphraum<NodeAttributes, EdgeAttributes>(container, graphOptions());
	graph.setData(fixture());
	const duration = performance.now() - startedAt;
	status.textContent = `${state.nodeCount.toLocaleString()} nodes · ${(state.nodeCount * state.edgeMultiplier).toLocaleString()} edges · ${duration.toFixed(1)}ms CPU update`;
	presentationTitle.textContent = "Select a node";
	presentationSubtitle.textContent = "Compiled metadata appears here.";
	presentationProperties.replaceChildren();
	presentationActions.replaceChildren();
	requestAnimationFrame(renderDiagnostics);
}

controls.addEventListener("change", rebuild);

container.addEventListener("click", (event) => {
	const selectedNode = graph.pick(event.clientX, event.clientY);
	graph.setSelection(selectedNode ? [selectedNode] : []);
	if (selectedNode) renderPresentation("Node", selectedNode);
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
	renderPresentation("Node", "node-0");
	requestAnimationFrame(renderDiagnostics);
});

function currentVariant(): Variant {
	const candidate = new URLSearchParams(location.search).get("variant");
	return variants.some((variant) => variant.id === candidate) ? (candidate as Variant) : "a";
}

function setVariant(next: Variant) {
	document.body.dataset.variant = next;
	const url = new URL(location.href);
	url.searchParams.set("variant", next);
	history.replaceState(null, "", url);
	const variant = variants.find((item) => item.id === next);
	variantLabel.textContent = variant ? `${variant.id.toUpperCase()} — ${variant.name}` : next;
	requestAnimationFrame(() => graph?.resize());
}

function cycleVariant(offset: number) {
	const currentIndex = variants.findIndex((variant) => variant.id === currentVariant());
	setVariant(variants[(currentIndex + offset + variants.length) % variants.length]?.id ?? "a");
}

requireElement<HTMLButtonElement>("#previous-variant").addEventListener("click", () => cycleVariant(-1));
requireElement<HTMLButtonElement>("#next-variant").addEventListener("click", () => cycleVariant(1));

document.addEventListener("keydown", (event) => {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea, [contenteditable]")) return;
	cycleVariant(event.key === "ArrowLeft" ? -1 : 1);
});

if (import.meta.env.PROD) requireElement<HTMLElement>("#prototype-switcher").hidden = true;
setVariant(currentVariant());
rebuild();
