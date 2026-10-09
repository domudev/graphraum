import { describe, expect, test } from "vitest";

import { compileGraph } from "../../../src/compile-graph";
import {
	createSceneUseCase,
	defaultPlaygroundState,
	parsePlaygroundState,
	resolveStressLayout,
	SCENE_CONTEXT_NODES,
	sceneCode,
	serializePlaygroundState,
} from "./playground-scenes";
import { demoVisuals, resolveDemoAction } from "./use-case-demos";

describe("playground deep links", () => {
	test("defaults to the knowledge scene in 2D", () => {
		expect(parsePlaygroundState("")).toEqual(defaultPlaygroundState);
	});

	test("reads scene, size and mode", () => {
		expect(parsePlaygroundState("?scene=stress&size=1000&mode=3d")).toEqual({
			mode: "3d",
			prove: false,
			scene: "stress",
			size: 1_000,
		});
	});

	test("opens Prove on the 100k stress scene unless a size is given", () => {
		expect(parsePlaygroundState("?scene=fraud&prove=1")).toMatchObject({ prove: true, scene: "stress", size: 100_000 });
		expect(parsePlaygroundState("?prove=1&size=10000")).toMatchObject({ size: 10_000 });
	});

	test("ignores unknown scenes and sizes", () => {
		expect(parsePlaygroundState("?scene=nope&size=7")).toEqual(defaultPlaygroundState);
	});

	test("round-trips through the query string and omits defaults", () => {
		const state = { mode: "3d", prove: false, scene: "stress", size: 100_000 } as const;

		expect(parsePlaygroundState(serializePlaygroundState(state))).toEqual(state);
		expect(serializePlaygroundState(defaultPlaygroundState)).toBe("");
		expect(serializePlaygroundState({ ...defaultPlaygroundState, scene: "fraud" })).toBe("?scene=fraud");
	});
});

describe("playground scenes", () => {
	test.each(["knowledge", "software", "fraud"] as const)("%s keeps the curated demo and grows valid context", (id) => {
		const useCase = createSceneUseCase(id);
		const compiled = compileGraph(useCase.data, demoVisuals);
		const firstNode = useCase.data.nodes[0];
		if (!firstNode) throw new Error("Scene has no nodes");

		expect(useCase.data.nodes.length).toBeGreaterThan(SCENE_CONTEXT_NODES);
		expect(compiled.nodePresentations.size).toBe(useCase.data.nodes.length);
		expect(resolveDemoAction(useCase, firstNode.id, "trace-connections").selectedNodeIds.length).toBeGreaterThan(1);
	});

	test("is deterministic", () => {
		expect(createSceneUseCase("knowledge").data).toEqual(createSceneUseCase("knowledge").data);
	});

	test("every scene has code to show", () => {
		for (const id of ["knowledge", "software", "fraud", "stress"] as const)
			expect(sceneCode(id)).toContain("Graphraum");
	});
});

describe("resolveStressLayout", () => {
	test("auto uses force below 100k and the grid at 100k", () => {
		expect(resolveStressLayout("auto", 10_000)).toBe("force");
		expect(resolveStressLayout("auto", 100_000)).toBe("grid");
	});

	test("keeps an explicit choice", () => {
		expect(resolveStressLayout("circle", 100_000)).toBe("circle");
	});
});
