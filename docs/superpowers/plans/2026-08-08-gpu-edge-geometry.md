# GPU Edge Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `LineBasicMaterial` edges with one instanced GPU edge batch that supports width, opacity, dash styles, and customizable triangle markers in 2D and 3D, degraded through existing viewport LOD.

**Architecture:** Validate edge visuals in `compileGraph`, pack screen-space segment and marker instances in a dedicated edge-rendering module (mirroring `node-rendering.ts`), and materialize only the LOD-allowed subset inside `Graphraum.materializeViewport` while keeping two draw calls.

**Tech Stack:** TypeScript, Three.js (`InstancedMesh`, `ShaderMaterial`), Vitest, Bun, existing graphraum LOD helpers.

**Spec:** `docs/superpowers/specs/2026-08-08-gpu-edge-geometry-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Public edge visual / theme / diagnostics types |
| `src/theme.ts` | Default `edgeWidth`, `edgeOpacity` |
| `src/edge-styles.ts` | Style/marker enums, encode helpers, assert helpers |
| `src/edge-styles.test.ts` | Validation and encode tests |
| `src/edge-rendering.ts` | Edge geometry, shader material, attribute writers |
| `src/edge-materialize.ts` | Pure packing of visible edges → segment/marker instance records |
| `src/edge-materialize.test.ts` | LOD packing tests |
| `src/compile-graph.ts` | Compile + validate full edge visuals |
| `src/compile-graph.test.ts` | Compile coverage for new fields |
| `src/graphraum.ts` | Wire InstancedMesh edges; update materialize/append/layout paths |
| `src/index.ts` | Export new public types/constants |
| `docs/src/content/docs/node-edge-presentation.mdx` | Mapper examples |
| `docs/src/content/docs/api-reference.mdx` | Type docs |
| `docs/src/content/docs/visual-language.mdx` | Remove “future GPU edge quads” hedge |
| `examples/benchmark/main.ts` + `controls.ts` | Lab controls for edge styles (minimal) |
| `changelogs/2026-08.md` | Customer-facing entry |

---

### Task 1: Public edge visual types and theme defaults

**Files:**
- Modify: `src/types.ts`
- Modify: `src/theme.ts`
- Modify: `src/theme.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing theme test**

```ts
// src/theme.test.ts — extend existing equality assertion
expect(graphraumTheme).toEqual({
	background: "#040f0f",
	dimmedNode: "#315a51",
	edge: "#226f54",
	edgeOpacity: 0.55,
	edgeWidth: 1.5,
	focusedNode: "#73c7a5",
	hoveredNode: "#e4a853",
	node: "#226f54",
	selectedNode: "#fcfffc",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/theme.test.ts`
Expected: FAIL — `edgeWidth` / `edgeOpacity` missing

- [ ] **Step 3: Add types and theme defaults**

In `src/types.ts`:

```ts
export type GraphraumEdgeStyle = "solid" | "dashed" | "dotted";
export type GraphraumEdgeMarker = "none" | "triangle";
export type GraphraumEdgeMarkerEnd = "target" | "source" | "both";

export interface GraphraumEdgeVisual {
	color?: GraphraumColor;
	width?: number;
	opacity?: number;
	style?: GraphraumEdgeStyle;
	marker?: GraphraumEdgeMarker;
	markerSize?: number;
	markerEnd?: GraphraumEdgeMarkerEnd;
}

export type GraphraumEdge<EdgeAttributes = undefined> = {
	color?: GraphraumColor;
	width?: number;
	opacity?: number;
	style?: GraphraumEdgeStyle;
	marker?: GraphraumEdgeMarker;
	markerSize?: number;
	markerEnd?: GraphraumEdgeMarkerEnd;
	id: string;
	source: string;
	target: string;
} & GraphraumAttributes<EdgeAttributes>;

export interface GraphraumTheme {
	background: GraphraumColor;
	dimmedNode: GraphraumColor;
	edge: GraphraumColor;
	edgeOpacity: number;
	edgeWidth: number;
	focusedNode: GraphraumColor;
	hoveredNode: GraphraumColor;
	node: GraphraumColor;
	selectedNode: GraphraumColor;
}

export interface GraphraumDiagnostics {
	// existing fields…
	visibleEdgeMarkers: number;
	visibleEdgeSegments: number;
	// keep visibleEdges as segment count alias behavior: set equal to visibleEdgeSegments
}
```

In `src/theme.ts` add `edgeWidth: 1.5`, `edgeOpacity: 0.55`.

Export new types from `src/index.ts`.

- [ ] **Step 4: Run theme test**

Run: `bunx vitest run src/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/theme.ts src/theme.test.ts src/index.ts
git commit -m "feat(types): extend edge visual and theme contract"
```

---

### Task 2: Edge style encode/assert helpers

**Files:**
- Create: `src/edge-styles.ts`
- Create: `src/edge-styles.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
	assertEdgeMarker,
	assertEdgeMarkerEnd,
	assertEdgeStyle,
	assertEdgeVisual,
	encodeEdgeMarker,
	encodeEdgeStyle,
	graphraumEdgeMarkers,
	graphraumEdgeStyles,
	markerInstanceCount,
} from "./edge-styles";

describe("edge-styles", () => {
	it("lists supported styles and markers", () => {
		expect(graphraumEdgeStyles).toEqual(["solid", "dashed", "dotted"]);
		expect(graphraumEdgeMarkers).toEqual(["none", "triangle"]);
	});

	it("encodes style and marker for shaders", () => {
		expect(encodeEdgeStyle("solid")).toBe(0);
		expect(encodeEdgeStyle("dashed")).toBe(1);
		expect(encodeEdgeStyle("dotted")).toBe(2);
		expect(encodeEdgeMarker("none")).toBe(0);
		expect(encodeEdgeMarker("triangle")).toBe(1);
	});

	it("counts marker instances from markerEnd", () => {
		expect(markerInstanceCount("none", "target")).toBe(0);
		expect(markerInstanceCount("triangle", "target")).toBe(1);
		expect(markerInstanceCount("triangle", "source")).toBe(1);
		expect(markerInstanceCount("triangle", "both")).toBe(2);
	});

	it("rejects invalid visuals with edge id context", () => {
		expect(() => assertEdgeVisual("e1", { width: 0 })).toThrow(/e1.*width/);
		expect(() => assertEdgeVisual("e1", { opacity: 1.2 })).toThrow(/e1.*opacity/);
		expect(() => assertEdgeStyle("e1", "wave")).toThrow(/e1.*style/);
		expect(() => assertEdgeMarker("e1", "arrow")).toThrow(/e1.*marker/);
		expect(() => assertEdgeMarkerEnd("e1", "middle")).toThrow(/e1.*markerEnd/);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/edge-styles.test.ts`
Expected: FAIL — module missing

- [ ] **Step 3: Implement `src/edge-styles.ts`**

```ts
import type {
	GraphraumEdgeMarker,
	GraphraumEdgeMarkerEnd,
	GraphraumEdgeStyle,
	GraphraumEdgeVisual,
} from "./types";

export const graphraumEdgeStyles = ["solid", "dashed", "dotted"] as const satisfies readonly GraphraumEdgeStyle[];
export const graphraumEdgeMarkers = ["none", "triangle"] as const satisfies readonly GraphraumEdgeMarker[];
export const graphraumEdgeMarkerEnds = ["target", "source", "both"] as const satisfies readonly GraphraumEdgeMarkerEnd[];

const styleCodes: Readonly<Record<GraphraumEdgeStyle, number>> = { solid: 0, dashed: 1, dotted: 2 };
const markerCodes: Readonly<Record<GraphraumEdgeMarker, number>> = { none: 0, triangle: 1 };

export function assertEdgeStyle(edgeId: string, style: unknown): asserts style is GraphraumEdgeStyle {
	if (typeof style !== "string" || !graphraumEdgeStyles.includes(style as GraphraumEdgeStyle)) {
		throw new Error(
			`Edge "${edgeId}" style must be one of: ${graphraumEdgeStyles.map((s) => `"${s}"`).join(", ")}`,
		);
	}
}

export function assertEdgeMarker(edgeId: string, marker: unknown): asserts marker is GraphraumEdgeMarker {
	if (typeof marker !== "string" || !graphraumEdgeMarkers.includes(marker as GraphraumEdgeMarker)) {
		throw new Error(
			`Edge "${edgeId}" marker must be one of: ${graphraumEdgeMarkers.map((m) => `"${m}"`).join(", ")}`,
		);
	}
}

export function assertEdgeMarkerEnd(edgeId: string, markerEnd: unknown): asserts markerEnd is GraphraumEdgeMarkerEnd {
	if (typeof markerEnd !== "string" || !graphraumEdgeMarkerEnds.includes(markerEnd as GraphraumEdgeMarkerEnd)) {
		throw new Error(
			`Edge "${edgeId}" markerEnd must be one of: ${graphraumEdgeMarkerEnds.map((m) => `"${m}"`).join(", ")}`,
		);
	}
}

export function assertEdgeVisual(edgeId: string, visual: GraphraumEdgeVisual): void {
	if (visual.width !== undefined && (!Number.isFinite(visual.width) || visual.width <= 0)) {
		throw new Error(`Edge "${edgeId}" visual must have a positive finite width`);
	}
	if (visual.opacity !== undefined && (!Number.isFinite(visual.opacity) || visual.opacity < 0 || visual.opacity > 1)) {
		throw new Error(`Edge "${edgeId}" visual opacity must be a finite number between 0 and 1`);
	}
	if (visual.markerSize !== undefined && (!Number.isFinite(visual.markerSize) || visual.markerSize <= 0)) {
		throw new Error(`Edge "${edgeId}" visual must have a positive finite markerSize`);
	}
	if (visual.style !== undefined) assertEdgeStyle(edgeId, visual.style);
	if (visual.marker !== undefined) assertEdgeMarker(edgeId, visual.marker);
	if (visual.markerEnd !== undefined) assertEdgeMarkerEnd(edgeId, visual.markerEnd);
}

export function encodeEdgeStyle(style: GraphraumEdgeStyle | undefined): number {
	return styleCodes[style ?? "solid"];
}

export function encodeEdgeMarker(marker: GraphraumEdgeMarker | undefined): number {
	return markerCodes[marker ?? "none"];
}

export function markerInstanceCount(
	marker: GraphraumEdgeMarker | undefined,
	markerEnd: GraphraumEdgeMarkerEnd | undefined,
): number {
	if ((marker ?? "none") === "none") return 0;
	return (markerEnd ?? "target") === "both" ? 2 : 1;
}
```

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/edge-styles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/edge-styles.ts src/edge-styles.test.ts
git commit -m "feat(edges): add style and marker encode helpers"
```

---

### Task 3: Compile-graph validation for edge visuals

**Files:**
- Modify: `src/compile-graph.ts`
- Modify: `src/compile-graph.test.ts`

- [ ] **Step 1: Write failing compile tests**

```ts
test("compiles full edge visuals from mapper and snapshot fields", () => {
	const graph = compileGraph(
		{
			nodes: [
				{ id: "a", position: { x: 0, y: 0 } },
				{ id: "b", position: { x: 1, y: 0 } },
			],
			edges: [
				{
					id: "a-b",
					source: "a",
					target: "b",
					width: 2,
					opacity: 0.8,
					style: "dashed",
					marker: "triangle",
					markerSize: 1.5,
					markerEnd: "both",
				},
			],
		},
	);
	expect(graph.edgeVisuals).toEqual([
		{
			width: 2,
			opacity: 0.8,
			style: "dashed",
			marker: "triangle",
			markerSize: 1.5,
			markerEnd: "both",
		},
	]);
});

test("rejects invalid edge opacity", () => {
	expect(() =>
		compileGraph({
			nodes: [
				{ id: "a", position: { x: 0, y: 0 } },
				{ id: "b", position: { x: 1, y: 0 } },
			],
			edges: [{ id: "a-b", source: "a", target: "b", opacity: 2 }],
		}),
	).toThrow(/a-b.*opacity/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/compile-graph.test.ts`
Expected: FAIL on new assertions / missing validation

- [ ] **Step 3: Implement `compileEdgeVisual` in `compile-graph.ts`**

```ts
import { assertEdgeVisual } from "./edge-styles";

function compileEdgeVisual(id: string, visual: GraphraumEdgeVisual): Readonly<GraphraumEdgeVisual> {
	assertEdgeVisual(id, visual);
	return Object.freeze({ ...visual });
}

// inside edge loop:
const encoding = visuals?.edge?.(edge);
const visual = compileEdgeVisual(
	edge.id,
	encoding?.visual ?? {
		color: edge.color,
		width: edge.width,
		opacity: edge.opacity,
		style: edge.style,
		marker: edge.marker,
		markerSize: edge.markerSize,
		markerEnd: edge.markerEnd,
	},
);
edgeVisuals.push(visual);
```

- [ ] **Step 4: Run compile tests**

Run: `bunx vitest run src/compile-graph.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/compile-graph.ts src/compile-graph.test.ts
git commit -m "feat(compile): validate compiled edge visuals"
```

---

### Task 4: Pure edge materialize / LOD packing

**Files:**
- Create: `src/edge-materialize.ts`
- Create: `src/edge-materialize.test.ts`

- [ ] **Step 1: Write failing packing tests**

```ts
import { describe, expect, it } from "vitest";
import { packEdgeInstances } from "./edge-materialize";

const endpoints = {
	// edge 0: a(0,0,0) -> b(10,0,0)
	positions: new Float32Array([0, 0, 0, 10, 0, 0]),
};

describe("packEdgeInstances", () => {
	it("packs one segment and omits markers in overview", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ marker: "triangle", markerEnd: "both", style: "dashed", width: 3, opacity: 0.9 }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "overview",
		});
		expect(packed.segments).toHaveLength(1);
		expect(packed.markers).toHaveLength(0);
		expect(packed.segments[0]?.style).toBe("solid");
		expect(packed.segments[0]?.width).toBe(1.5);
	});

	it("packs triangle markers at both ends in detail", () => {
		const packed = packEdgeInstances({
			edgeIndices: [0],
			edgeVisuals: [{ marker: "triangle", markerEnd: "both", width: 2 }],
			endpointPositions: endpoints.positions,
			defaults: { color: "#226f54", opacity: 0.55, width: 1.5 },
			tier: "detail",
		});
		expect(packed.segments).toHaveLength(1);
		expect(packed.markers).toHaveLength(2);
		expect(packed.markers.map((m) => m.end)).toEqual(["source", "target"]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/edge-materialize.test.ts`
Expected: FAIL — module missing

- [ ] **Step 3: Implement packing**

```ts
import type { GraphraumColor, GraphraumEdgeMarkerEnd, GraphraumEdgeStyle, GraphraumEdgeVisual } from "./types";

export type EdgeLodTier = "overview" | "detail";

export interface EdgeSegmentInstance {
	edgeIndex: number;
	x1: number; y1: number; z1: number;
	x2: number; y2: number; z2: number;
	color: GraphraumColor;
	width: number;
	opacity: number;
	style: GraphraumEdgeStyle;
}

export interface EdgeMarkerInstance {
	edgeIndex: number;
	end: "source" | "target";
	x: number; y: number; z: number;
	dx: number; dy: number; dz: number; // direction along edge for orientation
	color: GraphraumColor;
	size: number; // screen px, derived from width * markerSize
	opacity: number;
}

export function packEdgeInstances(input: {
	edgeIndices: readonly number[];
	edgeVisuals: readonly Readonly<GraphraumEdgeVisual>[];
	endpointPositions: Float32Array; // 6 floats per edge index in canonical order
	defaults: { color: GraphraumColor; opacity: number; width: number };
	tier: EdgeLodTier;
}): { segments: EdgeSegmentInstance[]; markers: EdgeMarkerInstance[] } {
	const segments: EdgeSegmentInstance[] = [];
	const markers: EdgeMarkerInstance[] = [];
	for (const edgeIndex of input.edgeIndices) {
		const visual = input.edgeVisuals[edgeIndex] ?? {};
		const base = edgeIndex * 6;
		const x1 = input.endpointPositions[base] ?? 0;
		const y1 = input.endpointPositions[base + 1] ?? 0;
		const z1 = input.endpointPositions[base + 2] ?? 0;
		const x2 = input.endpointPositions[base + 3] ?? 0;
		const y2 = input.endpointPositions[base + 4] ?? 0;
		const z2 = input.endpointPositions[base + 5] ?? 0;
		const color = visual.color ?? input.defaults.color;
		const width = input.tier === "overview" ? input.defaults.width : (visual.width ?? input.defaults.width);
		const opacity = input.tier === "overview" ? input.defaults.opacity : (visual.opacity ?? input.defaults.opacity);
		const style = input.tier === "overview" ? "solid" : (visual.style ?? "solid");
		segments.push({ edgeIndex, x1, y1, z1, x2, y2, z2, color, width, opacity, style });

		if (input.tier === "overview") continue;
		const marker = visual.marker ?? "none";
		if (marker === "none") continue;
		const markerSize = (visual.markerSize ?? 1) * width;
		const ends: GraphraumEdgeMarkerEnd = visual.markerEnd ?? "target";
		const add = (end: "source" | "target") => {
			const fromSource = end === "source";
			markers.push({
				edgeIndex,
				end,
				x: fromSource ? x1 : x2,
				y: fromSource ? y1 : y2,
				z: fromSource ? z1 : z2,
				dx: fromSource ? x1 - x2 : x2 - x1,
				dy: fromSource ? y1 - y2 : y2 - y1,
				dz: fromSource ? z1 - z2 : z2 - z1,
				color,
				size: markerSize,
				opacity,
			});
		};
		if (ends === "source" || ends === "both") add("source");
		if (ends === "target" || ends === "both") add("target");
	}
	return { segments, markers };
}

/** Map existing diagnostics lodLevel into the edge visual tier. */
export function edgeTierFromDiagnosticsLod(
	lodLevel: "density" | "detail" | "overview",
): EdgeLodTier {
	return lodLevel === "detail" ? "detail" : "overview";
}
```

- [ ] **Step 4: Run packing tests**

Run: `bunx vitest run src/edge-materialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/edge-materialize.ts src/edge-materialize.test.ts
git commit -m "feat(edges): pack LOD segment and marker instances"
```

---

### Task 5: Edge shader + GPU attribute helpers

**Files:**
- Create: `src/edge-rendering.ts`
- Create: `src/edge-rendering.test.ts` (attribute packing only; no WebGL)

- [ ] **Step 1: Write failing attribute tests**

```ts
import { describe, expect, it } from "vitest";
import { InstancedBufferAttribute } from "three";
import { createEdgeGeometry, writeEdgeSegmentInstance, writeEdgeMarkerInstance } from "./edge-rendering";

describe("edge-rendering attributes", () => {
	it("writes segment endpoints and style codes", () => {
		const geometry = createEdgeGeometry(2);
		const kind = geometry.getAttribute("instanceKind") as InstancedBufferAttribute;
		const a = geometry.getAttribute("instanceEndA") as InstancedBufferAttribute;
		const b = geometry.getAttribute("instanceEndB") as InstancedBufferAttribute;
		const style = geometry.getAttribute("instanceStyle") as InstancedBufferAttribute;
		writeEdgeSegmentInstance(geometry, 0, {
			edgeIndex: 0,
			x1: 0, y1: 0, z1: 0,
			x2: 10, y2: 0, z2: 0,
			color: "#226f54",
			width: 2,
			opacity: 0.5,
			style: "dashed",
		});
		expect(kind.getX(0)).toBe(0); // segment
		expect(a.getX(0)).toBe(0);
		expect(b.getX(0)).toBe(10);
		expect(style.getX(0)).toBe(1); // dashed
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/edge-rendering.test.ts`
Expected: FAIL — module missing

- [ ] **Step 3: Implement `edge-rendering.ts`**

Create `PlaneGeometry(1, 1)` based instancing helpers + `ShaderMaterial`:

- Vertex: for `instanceKind == 0` (segment), stretch a unit quad from EndA→EndB with screen-space width (same billboard trick as nodes: offset in view space using perpendicular to projected direction).
- Vertex: for `instanceKind == 1` (marker), place a filled triangle quad at the endpoint, oriented by `(dx,dy,dz)`, sized by `instanceWidth`.
- Fragment: segment applies alpha from `instanceColor.a`; dashed/dotted discard by distance along edge (`vEdgeT` + style code). Marker draws a filled triangle via `max` SDF in UV space (`1.0 - max(-uv.y, abs(uv.x) + uv.y)` or equivalent).
- Depth: `depthTest` true in 3D, false in 2D (mirror node material).

Export:

```ts
export function createEdgeGeometry(capacity: number): BufferGeometry
export function createEdgeMaterial(depthTest: boolean): ShaderMaterial
export function writeEdgeSegmentInstance(geometry, slot, segment): void
export function writeEdgeMarkerInstance(geometry, slot, marker): void
```

Instance attributes (minimum):

- `instanceKind` (float)
- `instanceEndA` (vec3)
- `instanceEndB` (vec3) — for markers, B unused or stores direction tip
- `instanceColor` (vec4 rgba)
- `instanceWidth` (float)
- `instanceStyle` (float)

Keep shaders in the same file as `node-rendering.ts` does.

- [ ] **Step 4: Run attribute tests**

Run: `bunx vitest run src/edge-rendering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/edge-rendering.ts src/edge-rendering.test.ts
git commit -m "feat(edges): add instanced edge shader batch"
```

---

### Task 6: Wire Graphraum to instanced edges

**Files:**
- Modify: `src/graphraum.ts`

- [ ] **Step 1: Replace edge object field**

Rename conceptual edge object from `edgeLines: LineSegments` to `edgeMesh: InstancedMesh`. Update `GraphraumGraphObjects`, `getGraphObjects`, `disposeGraphObjects`, `canAppendDataPatch`.

- [ ] **Step 2: Rebuild `replaceData` edge construction**

```ts
this.edgeCapacity = Math.min(this.maxVisibleEdges, nextCapacity(data.edges.length));
this.markerCapacity = Math.min(this.edgeCapacity * 2, nextCapacity(data.edges.length * 2));
const edgeInstanceCapacity = this.edgeCapacity + this.markerCapacity;
const edgeGeometry = createEdgeGeometry(edgeInstanceCapacity);
const edgeMaterial = createEdgeMaterial(this.mode === "3d");
const edgeMesh = new InstancedMesh(edgeGeometry, edgeMaterial, edgeInstanceCapacity);
edgeMesh.frustumCulled = false;
this.edgeMesh = edgeMesh;
this.scene.add(edgeMesh);
// store canonicalEdgePositions as today; store edgeVisuals on data.edges already via spread
```

Remove `LineBasicMaterial` / `LineSegments` imports if unused.

- [ ] **Step 3: Rewrite `materializeViewport` edge section**

```ts
const lodLevel = /* same computation as getDiagnostics */;
const tier = edgeTierFromDiagnosticsLod(lodLevel);
const packed = packEdgeInstances({
	edgeIndices: visibleEdgeIndices,
	edgeVisuals: this.data.edges,
	endpointPositions: this.canonicalEdgePositions,
	defaults: {
		color: this.theme.edge,
		opacity: this.theme.edgeOpacity,
		width: this.theme.edgeWidth,
	},
	tier,
});
let slot = 0;
for (const segment of packed.segments) {
	writeEdgeSegmentInstance(this.edgeMesh.geometry, slot, segment);
	this.visibleEdgeSlots.set(segment.edgeIndex, slot);
	slot += 1;
}
const segmentCount = slot;
for (const marker of packed.markers) {
	writeEdgeMarkerInstance(this.edgeMesh.geometry, slot, marker);
	slot += 1;
}
this.edgeMesh.count = slot;
// mark instance attributes needsUpdate / update ranges
this.visibleEdgeCount = segmentCount;
this.visibleEdgeSegmentCount = segmentCount;
this.visibleEdgeMarkerCount = packed.markers.length;
```

- [ ] **Step 4: Update layout/`updateNodes` edge endpoint writes**

When a node moves, update `canonicalEdgePositions` as today, then either:
- call `materializeViewport()` (simplest, correct with LOD), or
- patch only dirty visible segment/marker slots if already materialized.

Prefer calling the existing materialize path after prepared node updates when edges change endpoints (already happens indirectly if `requestRender` → materialize). Ensure `applyPreparedNodeUpdates` still updates canonical edge endpoint floats; remove direct `LineSegments` attribute writes.

- [ ] **Step 5: Update `appendDataPatch` color packing**

Stop writing 6-float line colors; ensure new edges’ visuals are on `data.edges` and `canonicalEdgePositions` grow as today. Marker capacity must remain `edgeCapacity * 2`. If append would exceed `edgeInstanceCapacity`, fall back to full `replaceData` (extend `canAppendDataPatch`).

- [ ] **Step 6: Update `getDiagnostics`**

```ts
visibleEdges: this.visibleEdgeSegmentCount,
visibleEdgeSegments: this.visibleEdgeSegmentCount,
visibleEdgeMarkers: this.visibleEdgeMarkerCount,
```

- [ ] **Step 7: Run package tests**

Run: `bunx vitest run src`
Expected: PASS (fix any broken graphraum tests referencing edgeLines)

- [ ] **Step 8: Commit**

```bash
git add src/graphraum.ts
git commit -m "feat(renderer): batch GPU edge segments and markers"
```

---

### Task 7: Docs, laboratory controls, changelog

**Files:**
- Modify: `docs/src/content/docs/node-edge-presentation.mdx`
- Modify: `docs/src/content/docs/api-reference.mdx`
- Modify: `docs/src/content/docs/visual-language.mdx`
- Modify: `examples/benchmark/controls.ts`
- Modify: `examples/benchmark/main.ts`
- Create or modify: `changelogs/2026-08.md`

- [ ] **Step 1: Update presentation docs example**

```ts
edge: (edge) => ({
  visual: {
    color: "#226f54",
    width: 2,
    opacity: 0.85,
    style: edge.attributes.relationship === "related" ? "dashed" : "solid",
    marker: "triangle",
    markerEnd: "target",
  },
  presentation: { title: edge.attributes.relationship },
}),
```

Note that coordinates stay on nodes; edges only declare style.

- [ ] **Step 2: Update API reference `GraphraumEdgeVisual` / theme / diagnostics fields**

- [ ] **Step 3: Replace visual-language “future GPU edge quads” paragraph with present-tense capability + LOD note

- [ ] **Step 4: Add laboratory controls**

Minimal controls in `examples/benchmark/controls.ts`:
- Edge width number
- Edge opacity number
- Edge style select (`solid|dashed|dotted`)
- Marker select (`none|triangle`)
- Marker end select (`target|source|both`)

Wire through fixture/visual mapper in `main.ts` so the lab proves the contract.

- [ ] **Step 5: Changelog entry** (follow `.agents/skills/changelog/SKILL.md`)

```md
### 2026-08-08

- Edges support width, opacity, dash styles, and triangle direction markers in the batched renderer, with overview LOD dropping markers first.
```

- [ ] **Step 6: Run checks**

Run:
```bash
bun run check
bun run test
bun run docs:check
```
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add docs examples changelogs src/index.ts
git commit -m "docs(edges): document GPU edge styles and lab controls"
```

---

### Task 8: Branch hygiene, issue comment, PR

- [ ] **Step 1: Create branch from current commits if still on `main`**

```bash
git checkout -b feat/gpu-edge-geometry
```

(If commits were made on `main` locally, move them onto the branch before pushing.)

- [ ] **Step 2: Comment on #30**

Summarize: GPU edge geometry slice implemented — instanced segments + markers, LOD degradation, docs/lab. Remaining #30 items if any (custom shader modules) stay open.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(edges): batch GPU edge geometry (#30)" --body "$(cat <<'EOF'
## What
Replace LineBasicMaterial edges with one instanced edge batch supporting width, opacity, dash, and triangle markers in 2D/3D.

## Why
Completes the next #30 renderer slice while keeping the two-draw-call budget and LOD-first performance model.

## Verification
- [x] `bun run check`
- [x] `bun run test`
- [x] `bun run docs:check`
- [ ] Manual lab check in 2D and 3D (width + markers + dash)

Closes nothing yet if #30 still has follow-ups; links #30.
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Edge visual contract + theme defaults | 1, 2, 3 |
| Coordinates separate (node endpoints) | 3, 4, 6 |
| Instanced segments + marker instances | 4, 5, 6 |
| Screen-space 2D+3D | 5, 6 |
| LOD: overview drops markers / forces solid | 4, 6 |
| Two draw calls | 6 |
| Validation errors | 2, 3 |
| Docs + lab | 7 |
| Out of scope aggregation / style patch API | explicitly omitted |

## Notes for implementers

- Do **not** introduce a third draw call for markers.
- Prefer `materializeViewport()` after layout updates over hand-patching every marker slot unless profiling demands it.
- Map diagnostics `lodLevel` `"density" | "overview"` → edge tier `overview`; `"detail"` → `detail`. Spec’s “exploration” middle tier can equal `detail` for marker inclusion in this slice (YAGNI).
- Keep Orwell/STE tone in docs; no internal Three.js names in customer-facing changelog.
