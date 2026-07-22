---
title: Renderer architecture
description: GPU main-thread rendering of worker-fetched feature data
guide_category: Core concepts
---

## Overview

JBrowse 2 renders feature data on the main thread with the GPU. The split is:

- The worker fetches feature data via RPC and returns it as compact typed arrays
  (absolute genomic uint32 coordinates). No rendering happens in the worker.
- The main thread draws the returned data with WebGPU, falling back to WebGL2,
  then Canvas2D. This covers the high-volume track types: alignments, wiggle,
  features, and variants.

Throughout this guide "renderer" means a plain class a display instantiates to
paint its canvas. The
[display owns the drawing](/docs/developer_guides/pluggable_elements#rendering);
there is no separate renderer pluggable element to register (no
`addRendererType`). The term carries over from an earlier architecture where
renderers were registered separately.

See `plugins/canvas` and `packages/render-core` for the implementation, and
[creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
to build one. The
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md)
is the canonical, in-depth reference for everything on this page.

## Display stacks

Which foundation mixin a display composes is the primary axis of code sharing;
_how_ it renders (GPU vs Canvas2D) is layered on top. The
[architecture spec's display-stacks table](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks)
enumerates the three foundations every in-tree display is built from:

- **`MultiRegionDisplayMixin`** — per-region fetch + render, the common case.
  Covers alignments, wiggle, features, variants, Manhattan, and reference
  sequence. Both the [Canvas2D](/docs/developer_guides/plotting_features) and
  [GPU](/docs/developer_guides/creating_gpu_display) walkthroughs use it.
- **`GlobalDataDisplayMixin`** — one non-regional dataset with no per-region
  partitioning (a heatmap spanning the whole view). Same slot/render plumbing
  but no fetch autoruns; the display installs its own via
  `installGlobalFetchAutorun`. Used by Hi-C (`LinearHicDisplay`) and LD.
- **`RegionTooLargeMixin` + custom `renderSvg`** — lightweight React-SVG, no GPU
  upload, no canvas at all. Used only by the low-volume displays: the arc
  display (`@jbrowse/plugin-arc`, `LinearArcDisplay`) and the circular chord
  display (`@jbrowse/plugin-circular-view`, `ChordVariantDisplay`). New track
  types should use one of the two foundations above rather than emitting SVG per
  feature.

## See also

- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
- [Custom display types](/docs/developer_guides/creating_display)
