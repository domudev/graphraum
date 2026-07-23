import { describe, expect, test } from "vitest";

import { compileGraph } from "../../../src/compile-graph";
import { demoUseCases, demoVisuals, resolveDemoAction } from "./use-case-demos";

describe("interactive SDK use-case demos", () => {
	test("ships three valid domain graphs with stable identity", () => {
		expect(demoUseCases.map(({ id }) => id)).toEqual(["knowledge", "dependencies", "investigation"]);

		for (const useCase of demoUseCases) {
			const nodeIds = new Set(useCase.data.nodes.map(({ id }) => id));
			const edgeIds = new Set(useCase.data.edges.map(({ id }) => id));

			expect(nodeIds.size).toBe(useCase.data.nodes.length);
			expect(edgeIds.size).toBe(useCase.data.edges.length);
			for (const edge of useCase.data.edges) {
				expect(nodeIds.has(edge.source)).toBe(true);
				expect(nodeIds.has(edge.target)).toBe(true);
			}
		}
	});

	test("compiles visuals and presentation for every demo entity", () => {
		for (const useCase of demoUseCases) {
			const compiled = compileGraph(useCase.data, demoVisuals);

			expect(compiled.nodePresentations.size).toBe(useCase.data.nodes.length);
			expect(compiled.edgePresentations.size).toBe(useCase.data.edges.length);
			expect(compiled.nodeVisuals.every(({ color, size }) => color !== undefined && size !== undefined)).toBe(true);
			expect(compiled.edgeVisuals.every(({ color }) => color !== undefined)).toBe(true);
		}
	});

	test("traces a node and its immediate neighbors without duplicates", () => {
		const result = resolveDemoAction(demoUseCases[0], "ada", "trace-connections");

		expect(result.selectedNodeIds).toEqual(["ada", "analytical-engine", "london", "mathematics"]);
		expect(result.message).toContain("3 direct connections");
	});

	test("dispatches domain-specific primary actions in the host", () => {
		const result = resolveDemoAction(demoUseCases[2], "account-a", "primary");

		expect(result.selectedNodeIds).toEqual(["account-a"]);
		expect(result.message).toBe("Account A added to the investigation review queue.");
	});

	test("rejects unknown entities and action IDs", () => {
		expect(() => resolveDemoAction(demoUseCases[0], "missing", "trace-connections")).toThrow(
			'Unknown demo node "missing"',
		);
		expect(() => resolveDemoAction(demoUseCases[0], "ada", "missing")).toThrow('Unknown demo action "missing"');
	});
});
