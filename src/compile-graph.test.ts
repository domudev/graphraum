import { describe, expect, test } from "vitest";

import { compileGraph } from "./compile-graph";
import { defineVisuals } from "./visuals";

describe("compileGraph", () => {
	test("builds edge positions from node identities", () => {
		const graph = compileGraph({
			edges: [{ id: "a-b", source: "a", target: "b" }],
			nodes: [
				{ id: "a", position: { x: 1, y: 2 } },
				{ id: "b", position: { x: 3, y: 4, z: 5 } },
			],
		});

		expect([...graph.nodePositions]).toEqual([1, 2, 0, 3, 4, 5]);
		expect([...graph.edgePositions]).toEqual([1, 2, 0, 3, 4, 5]);
		expect([...graph.edgeNodeIndices]).toEqual([0, 1]);
		expect(graph.incidentEdgeIndices).toEqual([[0], [0]]);
		expect(graph.nodeIndices.get("b")).toBe(1);
		expect(graph.nodeVisuals).toEqual([{}, {}]);
		expect(graph.edgeVisuals).toEqual([{}]);
	});

	test("maps typed attributes into immutable visuals and presentations once", () => {
		let nodeCalls = 0;
		let edgeCalls = 0;
		const properties = [{ id: "kind", label: "Kind", value: "Person" }] as const;
		const actions = [{ id: "inspect", label: "Inspect" }] as const;
		const visuals = defineVisuals<{ kind: "person" | "place" }, { relationship: string }>({
			node: (node) => {
				nodeCalls += 1;
				return {
					presentation: {
						actions,
						properties,
						subtitle: node.attributes.kind,
						title: node.id === "ada" ? "Ada Lovelace" : "London",
					},
					visual: {
						color: node.attributes.kind === "person" ? "#73c7a5" : "#226f54",
						shape: node.attributes.kind === "person" ? "circle" : "diamond",
						size: node.attributes.kind === "person" ? 8 : 6,
					},
				};
			},
			edge: (edge) => {
				edgeCalls += 1;
				return {
					presentation: { title: edge.attributes.relationship },
					visual: { color: "#469878" },
				};
			},
		});

		const graph = compileGraph(
			{
				edges: [
					{
						attributes: { relationship: "born in" },
						id: "born-in",
						source: "ada",
						target: "london",
					},
				],
				nodes: [
					{ attributes: { kind: "person" }, id: "ada", position: { x: 0, y: 0 } },
					{ attributes: { kind: "place" }, id: "london", position: { x: 10, y: 0 } },
				],
			},
			visuals,
		);

		expect(nodeCalls).toBe(2);
		expect(edgeCalls).toBe(1);
		expect(graph.nodeVisuals).toEqual([
			{ color: "#73c7a5", shape: "circle", size: 8 },
			{ color: "#226f54", shape: "diamond", size: 6 },
		]);
		expect(graph.edgeVisuals).toEqual([{ color: "#469878" }]);
		expect(graph.nodePresentations.get("ada")).toEqual({
			actions: [{ id: "inspect", label: "Inspect" }],
			properties: [{ id: "kind", label: "Kind", value: "Person" }],
			subtitle: "person",
			title: "Ada Lovelace",
		});
		expect(graph.edgePresentations.get("born-in")).toEqual({
			actions: [],
			properties: [],
			title: "born in",
		});
		expect(Object.isFrozen(graph.nodePresentations.get("ada"))).toBe(true);
		expect(Object.isFrozen(graph.nodePresentations.get("ada")?.properties)).toBe(true);
	});

	test("rejects unsupported mapper shapes at the ingestion boundary", () => {
		expect(() =>
			compileGraph(
				{ edges: [], nodes: [{ id: "customer-42", position: { x: 0, y: 0 } }] },
				defineVisuals({
					node: () => ({ visual: { shape: "hexagon" as "circle" } }),
				}),
			),
		).toThrow('Node "customer-42" shape must be one of: "circle", "square", "diamond"');
	});

	test.each([
		["title", { title: " " }, 'Node "a" presentation title must not be empty'],
		[
			"property id",
			{ properties: [{ id: "", label: "Kind", value: "person" }], title: "Ada" },
			'Node "a" presentation property id must not be empty',
		],
		[
			"duplicate property",
			{
				properties: [
					{ id: "kind", label: "Kind", value: "person" },
					{ id: "kind", label: "Type", value: "person" },
				],
				title: "Ada",
			},
			'Node "a" presentation has duplicate property id "kind"',
		],
		[
			"property value",
			{ properties: [{ id: "weight", label: "Weight", value: Number.NaN }], title: "Ada" },
			'Node "a" presentation property "weight" must have a finite numeric value',
		],
		[
			"non-scalar property value",
			{
				properties: [{ id: "owner", label: "Owner", value: { id: "ada" } }],
				title: "Ada",
			},
			'Node "a" presentation property "owner" must have a serializable scalar value',
		],
		[
			"action label",
			{ actions: [{ id: "inspect", label: "" }], title: "Ada" },
			'Node "a" presentation action "inspect" label must not be empty',
		],
		[
			"duplicate action",
			{
				actions: [
					{ id: "inspect", label: "Inspect" },
					{ id: "inspect", label: "Open" },
				],
				title: "Ada",
			},
			'Node "a" presentation has duplicate action id "inspect"',
		],
		[
			"action disabled state",
			{ actions: [{ disabled: "sometimes", id: "inspect", label: "Inspect" }], title: "Ada" },
			'Node "a" presentation action "inspect" disabled must be a boolean',
		],
	])("rejects invalid %s metadata", (_case, presentation, message) => {
		expect(() =>
			compileGraph(
				{ edges: [], nodes: [{ id: "a", position: { x: 0, y: 0 } }] },
				defineVisuals({
					node: () => ({ presentation: presentation as { title: string } }),
				}),
			),
		).toThrow(message);
	});

	test("uses direct snapshot visuals when no mapper overrides them", () => {
		const graph = compileGraph({
			edges: [{ color: "#469878", id: "a-a", source: "a", target: "a" }],
			nodes: [{ color: "#73c7a5", id: "a", position: { x: 0, y: 0 }, size: 7 }],
		});

		expect(graph.nodeVisuals).toEqual([{ color: "#73c7a5", size: 7 }]);
		expect(graph.edgeVisuals).toEqual([{ color: "#469878" }]);
	});

	test("rejects duplicate node identities before rendering", () => {
		expect(() =>
			compileGraph({
				edges: [],
				nodes: [
					{ id: "same", position: { x: 0, y: 0 } },
					{ id: "same", position: { x: 1, y: 1 } },
				],
			}),
		).toThrow('Duplicate node id: "same"');
	});

	test("rejects edges whose endpoints are absent", () => {
		expect(() =>
			compileGraph({
				edges: [{ id: "broken", source: "present", target: "missing" }],
				nodes: [{ id: "present", position: { x: 0, y: 0 } }],
			}),
		).toThrow('Edge "broken" references missing target "missing"');
	});
});
