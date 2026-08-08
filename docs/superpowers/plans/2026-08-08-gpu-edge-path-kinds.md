# GPU Edge Path Kinds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `straight` | `quadratic` | `cubic` edge paths by CPU-sampling curves into the existing instanced segment batch, with explicit `controlPoints`, auto defaults, tiered LOD, and viewport-first budgeting.

**Architecture:** Validate path/controls in `edge-styles` + `compile-graph`. Pure sampling/auto helpers in `edge-paths.ts`. `packEdgeInstances` expands each visible edge into 1/8/12 segments by LOD. `edgeInstanceCapacities` sizes segment buffer as `edgeCapacity * 12`. Diagnostics split `visibleEdges` vs `visibleEdgeSegments`.

**Tech Stack:** TypeScript, Three.js InstancedMesh (unchanged shaders), Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-08-08-gpu-edge-path-kinds-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/types.ts` | `GraphraumEdgePath`, visual/edge fields |
| `src/edge-styles.ts` | assert path + controlPoints |
| `src/edge-styles.test.ts` | validation tests |
| `src/edge-paths.ts` | auto controls, bezier sample, segment counts |
| `src/edge-paths.test.ts` | auto + sample tests |
| `src/edge-materialize.ts` | pack multi-segment polylines + marker tangents |
| `src/edge-materialize.test.ts` | LOD sample counts, overview collapse |
| `src/compile-graph.ts` | pass path/controlPoints through compile |
| `src/compile-graph.test.ts` | compile coverage |
| `src/graphraum.ts` | capacity ×12, diagnostics, truncate on overflow |
| `src/graphraum.test.ts` | capacity formula |
| `src/index.ts` | export path type + constants if public |
| docs / lab / playground / changelog | surfaces |

---

### Task 1: Types + validation

**Files:** `src/types.ts`, `src/edge-styles.ts`, `src/edge-styles.test.ts`, `src/index.ts`

- [ ] Add `GraphraumEdgePath`, fields on `GraphraumEdge` / `GraphraumEdgeVisual`
- [ ] `assertEdgePath`, extend `assertEdgeVisual` for control point counts/finite coords
- [ ] Export from `src/index.ts`
- [ ] Tests for invalid path / wrong control counts
- [ ] Commit

### Task 2: Path sampling helpers

**Files:** Create `src/edge-paths.ts`, `src/edge-paths.test.ts`

- [ ] `DETAIL_MAX_SEGMENTS = 12`, `segmentCountForPath(path, tier)`
- [ ] `autoControlPoints(path, x1..z2)`
- [ ] `sampleEdgePath(...)` → list of points including endpoints
- [ ] Tests: counts, deterministic auto, quadratic/cubic endpoints match
- [ ] Commit

### Task 3: Pack multi-segment edges

**Files:** `src/edge-materialize.ts`, `src/edge-materialize.test.ts`

- [ ] Overview: always 1 straight segment (ignore path)
- [ ] Detail: expand via `sampleEdgePath`
- [ ] Markers use first/last segment tangents
- [ ] Tests for 8/12 segments, overview collapse, marker dx
- [ ] Commit

### Task 4: Capacity + Graphraum wiring + compile

**Files:** `src/graphraum.ts`, `src/graphraum.test.ts`, `src/compile-graph.ts`, `src/compile-graph.test.ts`

- [ ] `edgeInstanceCapacities`: `segmentCapacity = edgeCapacity * 12`
- [ ] Stop packing when segment slot would exceed capacity
- [ ] `visibleEdges` = distinct edge ids; keep `visibleEdgeSegments`
- [ ] Compile passes `path` / `controlPoints`
- [ ] Commit

### Task 5: Docs, lab, playground, changelog

**Files:** docs MDX, `examples/benchmark/*`, `docs/src/lib/playground.ts`, Explore controls, `changelogs/2026-08.md`

- [ ] Document path API
- [ ] Lab + Explore controls
- [ ] Changelog
- [ ] `bun run test`, `bun run docs:test`, `bunx tsc --noEmit`
- [ ] Commit + PR

---
