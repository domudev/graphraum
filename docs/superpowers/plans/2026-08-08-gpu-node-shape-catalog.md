# GPU Node Shape Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SDF shapes `hexagon`/`triangle`/`pill`/`rounded`, optional stroke, and independent `width`/`height` while keeping one node draw call.

**Architecture:** Extend `node-shapes` encode/pick helpers, expand the node fragment SDF + stroke attrs in `node-rendering`, resolve axes via a small pure helper, wire `graphraum` matrix/attrs/picking, validate in compile + updates.

**Tech Stack:** TypeScript, Three.js InstancedMesh/ShaderMaterial, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-08-08-gpu-node-shape-catalog-design.md`  
**Issue:** #80

---

## File structure

| File | Role |
|------|------|
| `src/types.ts` | Shape union; node visual/geometry/update fields; theme `nodeStroke` |
| `src/theme.ts` + test | Default `nodeStroke` |
| `src/node-axes.ts` + test | Pure `resolveNodeAxes(visual)` → `{ width, height }` |
| `src/node-shapes.ts` + test | Encode 0–6, SDF hit tests for new shapes |
| `src/node-rendering.ts` + test | Shader + stroke attrs + writers |
| `src/compile-graph.ts` + test | Validate new fields |
| `src/node-updates.ts` + test | width/height/stroke on updates |
| `src/spatial-grid-2d.ts` | Occupancy radius from max(width,height)+stroke |
| `src/graphraum.ts` | makeScale(w,h), write stroke attrs, pick |
| Docs, lab, changelog | Public surface |

---

### Task 1: Types + theme `nodeStroke`

**Files:** `src/types.ts`, `src/theme.ts`, `src/theme.test.ts`, `src/index.ts` if needed

- [ ] Extend `GraphraumNodeShape` with `hexagon` | `triangle` | `pill` | `rounded`
- [ ] Add to `GraphraumNodeGeometry`, `GraphraumNodeVisual`, `GraphraumNodeUpdate`: `width?`, `height?`, `strokeWidth?`, `strokeColor?`
- [ ] Theme: `nodeStroke: "#fcfffc"` (or similar porcelain)
- [ ] TDD theme test; commit `feat(types): extend node shape stroke and axes contract`

---

### Task 2: `resolveNodeAxes` helper

**Files:** Create `src/node-axes.ts`, `src/node-axes.test.ts`

```ts
export function resolveNodeAxes(input: {
  size?: number;
  width?: number;
  height?: number;
  defaultSize?: number; // default 4
}): { width: number; height: number }
```

Rules: `width ?? size ?? defaultSize`, `height ?? size ?? defaultSize`. Throw if resolved value ≤ 0 or non-finite (caller may pass id for messages — or validate separately).

- [ ] TDD; commit `feat(nodes): resolve width and height axes`

---

### Task 3: Shape encode + pick for seven shapes

**Files:** `src/node-shapes.ts`, `src/node-shapes.test.ts`

Encode map:

| shape | code |
|-------|------|
| circle | 0 |
| square | 1 |
| diamond | 2 |
| hexagon | 3 |
| triangle | 4 |
| pill | 5 |
| rounded | 6 |

`containsNodePoint(shape, x, y)` in unit space [-1,1] (pre-scale):

- hexagon: regular hex SDF (`max(abs(x), abs(x)*0.5+abs(y)*0.866...)` style) ≤ 1
- triangle: point-in-equilateral / SDF
- pill: capsule SDF (horizontal stadium)
- rounded: rounded box SDF (e.g. radius ~0.25 of half-extent)

Update invalid-shape error to list all seven.

- [ ] TDD including encode undefined → 0; commit `feat(nodes): encode hexagon triangle pill rounded`

---

### Task 4: Compile-graph validation

**Files:** `src/compile-graph.ts`, `src/compile-graph.test.ts`

Extend `compileNodeVisual`:

- validate size/width/height positive finite
- strokeWidth ≥ 0 finite
- assert shape
- freeze full visual including stroke/axes fields
- snapshot merge includes new fields from node

- [ ] TDD; commit `feat(compile): validate node stroke and axes`

---

### Task 5: Node shader stroke + attrs

**Files:** `src/node-rendering.ts`, `src/node-rendering.test.ts`

- Geometry attrs: `instanceStrokeWidth` (float), `instanceStrokeColor` (vec3)
- Fragment: compute `dist` SDF per shape code; fill alpha from outer; if strokeWidth > 0, stroke band between outer and outer-stroke; mix colors
- Export `setNodeStrokeAt(geometry|attrs, index, { strokeWidth, strokeColor })` or write helpers
- Attribute packing tests (no WebGL)

Stroke width in shader: pass as fraction of half-extent in UV (`strokeWidthPx / max(width,height)` computed on CPU when writing).

- [ ] TDD attrs; commit `feat(nodes): sdf stroke ring in node shader`

---

### Task 6: Wire Graphraum + updates + spatial grid

**Files:** `src/graphraum.ts`, `src/node-updates.ts`, `src/node-updates.test.ts` if exists, `src/spatial-grid-2d.ts` (+test)

- `prepareNodeUpdates`: merge width/height/stroke*; `sizeChanged` becomes true if any axis/stroke change that affects matrix/attrs (or split flags)
- All `makeScale(size,size,size)` → `resolveNodeAxes` then `makeScale(w, h, max(w,h) or 1)`
- Pick mesh scale: use max(w,h) * SQRT2 (+ stroke inflation)
- Write stroke attrs in materialize + update paths
- `getNodeColor` unchanged (fill)
- Spatial grid: use max(w,h) + stroke for cell radius / pick
- 3D pick radius similarly

- [ ] `bunx tsc --noEmit && bunx vitest run src`
- [ ] Commit `feat(renderer): wire node axes shapes and stroke`

---

### Task 7: Docs, lab, changelog, PR

- Update `node-edge-presentation.mdx`, `api-reference.mdx`, `visual-language.mdx` if needed
- Lab controls: shape select (7), stroke width/color, width/height
- `changelogs/2026-08.md` day entry
- Comment on #80; open PR linking #80 (edge paths remain open)

```bash
git commit -m "docs(nodes): document shape catalog stroke and axes"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Seven shapes | 1, 3, 5 |
| Stroke | 1, 4, 5, 6 |
| width/height | 2, 4, 6 |
| Picking outer | 3, 6 |
| One draw call | 5, 6 |
| Docs/lab | 7 |

## Notes

- Keep encode codes stable; never reorder existing 0–2.
- Interaction tint = fill only.
- Edge paths out of scope.
