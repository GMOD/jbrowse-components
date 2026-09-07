---
name: reviving-the-in-repo-plugins-graph-packages-graph-core
description: Reviving the in-repo `plugins/graph` + `packages/graph-core`
area: comparative-and-pangenome
---

# Reviving the in-repo `plugins/graph` + `packages/graph-core`

the
Bandage-style `GraphGenomeView` and `plugins/tube-map-view`, removed by
`884a126861` and `3b98dbb985`, were restored from `c72b88d177` in 2026-07 and
ported to a Canvas2D-first render path (typecheck clean, 98 graph tests green,
never rendered in a browser). Abandoned: graph work now lives in the external
`jbrowse-plugin-graphgenomeview` bundle, which shipped the subgraph figure the
revival was for. **The plugin was never the hard part** — the whole cost was
three months of GPU-stack drift (`@jbrowse/core/gpu/*` → `packages/render-core`
and the `installGpuDisplay` → `attachRenderingBackend` lifecycle redesign), so
a revival re-pays that bill and buys a second graph view. Recovery base is
`c72b88d177`, last commit with everything present and wired; the tip with
cs-enriched PAF and the multi-anchor demo is `1153a0beb8`. Prior art for the
data side is in [PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md#prior-art).
