<p align="center">
  <strong>Graphraum</strong>
  <br>
  <sub>Nodes. Edges. Space.</sub>
</p>

# Graphraum

An opinionated WebGL engine for interactive node-edge graphs in 2D and 3D.

Graphraum is deliberately narrow: it renders graphs, accepts positions from any layout engine, and keeps the hot path outside a component framework. Nodes use one instanced mesh, edges use one batched geometry, and rendering happens on demand.

> Early development. The API will change before the first release.

## Principles

- Graph-native data: nodes, edges, stable identities, positions, and selection.
- Native 2D first, with 3D available over the same graph state.
- One node draw call and one edge draw call for the baseline scene.
- Layout is an input, not hidden renderer work.
- Framework adapters belong outside the rendering core.

## Development

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

The benchmark example can switch between 1,000 nodes / 3,000 edges and 10,000 nodes / 30,000 edges, as well as between 2D and 3D.

```sh
bun run test
bun run check
bun run build
```

## Status

The initial engine includes batched edges, instanced nodes, explicit render scheduling, 2D and 3D cameras, selection colors, picking, fitting, resize handling, and resource disposal. Smooth 2D–3D camera transitions, semantic label LOD, incremental buffer updates, and accessibility adapters remain ahead.

## License

Apache-2.0
