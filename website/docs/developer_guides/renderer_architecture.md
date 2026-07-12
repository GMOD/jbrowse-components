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

See `plugins/canvas` and `packages/render-core` for the implementation, and
[creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
to build one.

## Low-volume displays

A few low-volume displays skip the GPU path and draw with plain main-thread SVG:
the arc display (`@jbrowse/plugin-arc`, `LinearArcDisplay`) and the circular
chord display (`@jbrowse/plugin-circular-view`, `ChordVariantDisplay`). New
track types should use the GPU path above rather than emitting SVG per feature.

## See also

- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
- [Data fetching pipeline](/docs/developer_guides/data_fetching) - the
  worker-fetch side that feeds the renderer
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [Adding SVG export to a display](/docs/developer_guides/svg_export) - the
  shared `paintLayer` draw path
- [Custom display types](/docs/developer_guides/creating_display) - displays own
  the drawing
- [Pluggable elements](/docs/developer_guides/pluggable_elements) - overview of
  all element types
