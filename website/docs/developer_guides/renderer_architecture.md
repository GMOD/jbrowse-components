---
title: Renderer architecture
description: GPU main-thread rendering and the legacy worker-renderer path
guide_category: Core concepts
---

## Overview

JBrowse 2 is transitioning from worker-rendered image tiles to GPU-based
rendering. Two paths coexist:

- **GPU/main-thread rendering (current direction).** The worker fetches feature
  data via RPC and returns it as compact typed arrays (absolute genomic uint32
  coordinates). The main thread then draws with WebGPU, falling back to WebGL,
  then Canvas2D. This covers the high-volume track types — alignments, wiggle,
  features, variants. See `plugins/canvas` and `packages/core/src/gpu`.
- **Worker-renderer (legacy).** A few specialized renderers still run the older
  pattern, where the worker produces the rendered output and transfers it back.
  These are subclasses of `ServerSideRendererType` and are now limited to
  renderers like `ArcRenderer` and `StructuralVariantChordRenderer`.

## Worker-renderer class hierarchy

The remaining worker-renderer base classes (in
`packages/core/src/pluggableElementTypes/renderers`):

```
RendererType (base)
└── ServerSideRendererType (RPC bridge)
    ├── FeatureRendererType (feature fetching + serialization)  // e.g. ArcRenderer
    │   ├── CircularChordRendererType   // e.g. StructuralVariantChordRenderer
    │   └── BoxRendererType (layout management)
```

For creating a renderer in the legacy worker pattern, see
[creating renderers](/docs/developer_guides/creating_renderer). For GPU
rendering, see the source under `plugins/canvas` and `packages/core/src/gpu`.
