import Graph from "graphology";
import { expect, test, vi } from "vitest";

import { bindGraphology } from "./graphology";

test("projects a Graphology graph and renders nodes before layout is available", () => {
	const graph = new Graph<{ color?: string; x?: number; y?: number }, { color?: string }>();
	graph.addNode("ada", { color: "#73c7a5" });
	graph.addNode("london", { x: 10, y: 20 });
	graph.addEdgeWithKey("born-in", "ada", "london", { color: "#469878" });
	const renderer = { setData: vi.fn() };

	bindGraphology(renderer, graph);

	expect(renderer.setData).toHaveBeenCalledWith({
		edges: [
			{
				attributes: { color: "#469878" },
				color: "#469878",
				id: "born-in",
				source: "ada",
				target: "london",
			},
		],
		nodes: [
			{
				attributes: { color: "#73c7a5" },
				color: "#73c7a5",
				id: "ada",
				position: { x: 0, y: 0 },
			},
			{
				attributes: { x: 10, y: 20 },
				id: "london",
				position: { x: 10, y: 20 },
			},
		],
	});
});

test("coalesces node and domain attribute mutations into one graph replacement", async () => {
	const graph = new Graph<{ color?: string; kind?: string; size?: number; x?: number; y?: number }>();
	graph.addNode("ada", { x: 0, y: 0 });
	const renderer = { setData: vi.fn() };
	bindGraphology(renderer, graph);
	renderer.setData.mockClear();

	graph.mergeNodeAttributes("ada", { color: "#73c7a5", kind: "person", x: 10 });
	graph.mergeNodeAttributes("ada", { size: 8, y: 20 });
	await Promise.resolve();

	expect(renderer.setData).toHaveBeenCalledOnce();
	expect(renderer.setData.mock.calls[0]?.[0].nodes[0]).toMatchObject({
		attributes: { color: "#73c7a5", kind: "person", size: 8, x: 10, y: 20 },
		color: "#73c7a5",
		position: { x: 10, y: 20 },
		size: 8,
	});
});

test("coalesces topology mutations into one graph replacement", async () => {
	const graph = new Graph<{ x?: number; y?: number }>();
	graph.addNode("ada", { x: 0, y: 0 });
	const renderer = { setData: vi.fn() };
	bindGraphology(renderer, graph);
	renderer.setData.mockClear();

	graph.addNode("london", { x: 10, y: 20 });
	graph.addEdgeWithKey("born-in", "ada", "london");
	await Promise.resolve();

	expect(renderer.setData).toHaveBeenCalledOnce();
	expect(renderer.setData.mock.calls[0]?.[0]).toMatchObject({
		edges: [{ id: "born-in", source: "ada", target: "london" }],
		nodes: [{ id: "ada" }, { id: "london" }],
	});
});

test("stops rendering mutations after disposal", async () => {
	const graph = new Graph<{ x?: number; y?: number }>();
	graph.addNode("ada", { x: 0, y: 0 });
	const renderer = { setData: vi.fn() };
	const dispose = bindGraphology(renderer, graph);
	renderer.setData.mockClear();

	dispose();
	graph.setNodeAttribute("ada", "x", 10);
	graph.addNode("london", { x: 20, y: 0 });
	await Promise.resolve();

	expect(renderer.setData).not.toHaveBeenCalled();
});

test("renders bulk node attribute mutations", async () => {
	const graph = new Graph<{ x: number; y: number }>();
	graph.addNode("ada", { x: 0, y: 0 });
	graph.addNode("london", { x: 10, y: 20 });
	const renderer = { setData: vi.fn() };
	bindGraphology(renderer, graph);
	renderer.setData.mockClear();

	graph.updateEachNodeAttributes((_id, attributes) => ({ ...attributes, x: attributes.x + 5 }));
	await Promise.resolve();

	expect(renderer.setData).toHaveBeenCalledOnce();
	expect(renderer.setData.mock.calls[0]?.[0].nodes).toMatchObject([
		{ id: "ada", position: { x: 5, y: 0 } },
		{ id: "london", position: { x: 15, y: 20 } },
	]);
});
