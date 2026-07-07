---
title: Renderer architecture
description: GPU main-thread rendering of worker-fetched feature data
guide_category: Core concepts
---

## Overview

JBrowse 2 renders feature data on the main thread with the GPU. The split is:

- **Worker** — fetches feature data via RPC and returns it as compact typed
  arrays (absolute genomic uint32 coordinates). No rendering happens in the
  worker.
- **Main thread** — draws the returned data with WebGPU, falling back to WebGL2,
  then Canvas2D. This covers the high-volume track types: alignments, wiggle,
  features, and variants.

See `plugins/canvas` and `packages/render-core` for the implementation, and
[creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
to build one.

## Specialized renderers

A few specialized renderers still draw in the worker and transfer the rendered
output back — `ArcRenderer` (`@jbrowse/plugin-arc`) and
`StructuralVariantChordRenderer` (`@jbrowse/plugin-circular-view`). They
subclass `ServerSideRendererType` in
`packages/core/src/pluggableElementTypes/renderers`. New track types should use
the GPU path above rather than this pattern.

## See also

- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Data fetching pipeline](/docs/developer_guides/data_fetching) — the
  worker-fetch side that feeds the renderer
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [Adding SVG export to a display](/docs/developer_guides/svg_export) — the
  shared `paintLayer` draw path
- [Custom display types](/docs/developer_guides/creating_display) — displays are
  the natural owner/invoker of a renderer
- [Pluggable elements](/docs/developer_guides/pluggable_elements) — overview of
  all element types, including renderers
