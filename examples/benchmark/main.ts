import { Graphraum, type GraphraumData } from "../../src";

function fixture(nodeCount: number): GraphraumData {
	const edgeCount = nodeCount * 3;
	const columns = Math.ceil(Math.sqrt(nodeCount));
	const nodes = Array.from({ length: nodeCount }, (_, index) => ({
		id: `node-${index}`,
		position: {
			x: (index % columns) * 12,
			y: Math.floor(index / columns) * 12,
			z: ((index * 17) % 101) - 50,
		},
		...(index === 0 ? { color: "#fcfffc" } : index % 11 === 0 ? { color: "#73c7a5" } : {}),
		size: 2.5,
	}));
	const edges = Array.from({ length: edgeCount }, (_, index) => ({
		id: `edge-${index}`,
		source: `node-${index % nodeCount}`,
		target: `node-${(index * 97 + 13) % nodeCount}`,
	}));
	return { edges, nodes };
}

function requireElement<ElementType extends Element>(selector: string) {
	const element = document.querySelector<ElementType>(selector);
	if (!element) throw new Error(`Benchmark element not found: ${selector}`);
	return element;
}

const container = requireElement<HTMLElement>("#graph");
const metrics = requireElement<HTMLElement>("#metrics");
const modeButton = requireElement<HTMLButtonElement>("#mode");

const graph = new Graphraum(container);

function load(nodeCount: number) {
	const startedAt = performance.now();
	graph.setData(fixture(nodeCount));
	metrics.textContent = `${nodeCount.toLocaleString()} nodes · ${(nodeCount * 3).toLocaleString()} edges · ${(performance.now() - startedAt).toFixed(1)}ms CPU update`;
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-size]")) {
	button.addEventListener("click", () => load(Number(button.dataset.size)));
}

modeButton.addEventListener("click", () => {
	const nextMode = graph.getMode() === "2d" ? "3d" : "2d";
	graph.setMode(nextMode);
	modeButton.textContent = `Switch to ${nextMode === "2d" ? "3D" : "2D"}`;
});

container.addEventListener("click", (event) => {
	const selectedNode = graph.pick(event.clientX, event.clientY);
	graph.setSelection(selectedNode ? [selectedNode] : []);
});

load(1_000);
