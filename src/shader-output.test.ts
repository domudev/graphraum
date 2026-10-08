import { RawShaderMaterial, ShaderChunk, type ShaderMaterial } from "three";
import { describe, expect, test } from "vitest";

import { createEdgeMaterial } from "./edge-rendering";
import { createNodeGlowMaterial } from "./node-glow-rendering";
import { createNodeMaterial } from "./node-rendering";
import { OUTPUT_COLOR_SPACE_FRAGMENT } from "./shader-output";

/** Resolves `#include <chunk>` the way three's WebGLProgram does, one level deep. */
function resolveIncludes(source: string): string {
	return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_, name: string) => {
		const chunk = (ShaderChunk as Record<string, string>)[name];
		if (chunk === undefined) throw new Error(`unknown shader chunk <${name}>`);
		return chunk;
	});
}

/** Statements of `main()` in source order, ignoring comments and blank lines. */
function mainStatements(source: string): string[] {
	const body = source.slice(source.indexOf("void main()"));
	return body
		.split("\n")
		.map((line) => line.replace(/\/\/.*$/, "").trim())
		.filter((line) => line.includes("gl_FragColor"));
}

const displayMaterials: readonly [string, () => ShaderMaterial][] = [
	["node", () => createNodeMaterial(false)],
	["node 3d", () => createNodeMaterial(true)],
	["edge", () => createEdgeMaterial()],
	["node glow", () => createNodeGlowMaterial("additive")],
	["node glow light", () => createNodeGlowMaterial("normal")],
];

describe("display shader output encoding", () => {
	test("encodes through three's colorspace chunk, which converts rgb and keeps alpha", () => {
		expect(OUTPUT_COLOR_SPACE_FRAGMENT).toBe("#include <colorspace_fragment>");
		// `linearToOutputTexel` is sRGB OETF on rgb with alpha passed through on an sRGB canvas and
		// a no-op on linear render targets; three defines it in every non-raw ShaderMaterial prefix.
		expect(ShaderChunk.colorspace_fragment.trim()).toBe("gl_FragColor = linearToOutputTexel( gl_FragColor );");
	});

	test.each(displayMaterials)("%s material encodes its final color exactly once", (_, create) => {
		const material = create();
		// RawShaderMaterial gets no prefix, so `linearToOutputTexel` would be undefined there.
		expect(material).not.toBeInstanceOf(RawShaderMaterial);
		const statements = mainStatements(resolveIncludes(material.fragmentShader));
		const encodes = statements.filter((statement) => statement.includes("linearToOutputTexel"));
		expect(encodes).toHaveLength(1);
		expect(statements.at(-1)).toBe("gl_FragColor = linearToOutputTexel( gl_FragColor );");
		material.dispose();
	});
});
