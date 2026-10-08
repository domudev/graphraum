import { InstancedMesh, ShaderMaterial } from "three";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("three", async (importOriginal) => {
	const actual = await importOriginal<typeof import("three")>();
	const { FakeWebGLRenderer } = await import("./test-support/fake-webgl");
	return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import type { Graphraum } from "./graphraum";
import { createGraph, destroyGraphs, internals } from "./test-support/edge-harness";
import { installFakeBrowserGlobals } from "./test-support/fake-webgl";
import type { GraphraumMode } from "./types";

beforeAll(() => installFakeBrowserGlobals((name, value) => vi.stubGlobal(name, value)));
afterEach(() => destroyGraphs());

function shaderMesh(mesh: unknown): { material: ShaderMaterial; renderOrder: number } {
	if (!(mesh instanceof InstancedMesh) || !(mesh.material instanceof ShaderMaterial)) {
		throw new Error("expected an instanced shader mesh");
	}
	return { material: mesh.material, renderOrder: mesh.renderOrder };
}

function meshes(graph: Graphraum) {
	const graphInternals = graph as unknown as { edgeMesh: unknown; nodeMesh: unknown };
	return { edges: shaderMesh(internals(graph).edgeMesh), nodes: shaderMesh(graphInternals.nodeMesh) };
}

function hub(mode: GraphraumMode) {
	const graph = createGraph({ mode });
	graph.setData({
		edges: [{ id: "e", source: "a", target: "b" }],
		nodes: [
			{ id: "a", position: { x: 0, y: 0, z: 0 } },
			{ id: "b", position: { x: 20, y: 0, z: 40 } },
		],
	});
	return graph;
}

function expectEdgesUnderNodes(graph: Graphraum, mode: GraphraumMode) {
	const { edges, nodes } = meshes(graph);
	// Transparent objects sort by renderOrder before depth, so edges always draw first.
	expect(edges.renderOrder).toBeLessThan(nodes.renderOrder);
	expect(edges.material).toMatchObject({ depthTest: false, depthWrite: false, transparent: true });
	expect(nodes.material).toMatchObject({ depthTest: mode === "3d", depthWrite: mode === "3d", transparent: true });
}

describe("edge and node draw order", () => {
	test.each(["2d", "3d"] as const)("draws edges under nodes without touching depth in %s", (mode) => {
		expectEdgesUnderNodes(hub(mode), mode);
	});

	test.each([
		["2d", "3d"],
		["3d", "2d"],
	] as const)("keeps edges under nodes after switching from %s to %s", (from, to) => {
		const graph = hub(from);
		graph.setMode(to);
		expectEdgesUnderNodes(graph, to);
	});
});
