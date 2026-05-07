---
id: renderer_architecture
title: Renderer architecture
---

:::caution

This architecture is under active revision. The renderer system is being
reworked to use WebGL/WebGPU. The concepts below reflect the current
canvas/RPC-based system and will change.

:::

## Overview

JBrowse 2 renderers run in a web worker to keep the main thread responsive.
Render arguments are serialized from the client, sent to the worker, and results
are transferred back.

## Renderer class hierarchy

```
RendererType (base)
└── ServerSideRendererType (RPC bridge)
    ├── FeatureRendererType (feature fetching + serialization)
    │   ├── CircularChordRendererType
    │   ├── ArcRenderer
    │   ├── DivSequenceRenderer
    │   ├── WiggleBaseRenderer (canvas)
    │   ├── MultiVariantBaseRenderer (canvas)
    │   └── BoxRendererType (layout management)
    │       ├── LollipopRenderer
    │       ├── SvgFeatureRenderer
    │       ├── PileupRenderer (canvas)
    │       └── CanvasFeatureRenderer (canvas)
    ├── HicRenderer
    └── DotplotRenderer (canvas)
```

## Two rendering patterns

**React-based renderers** (e.g. `SvgFeatureRenderer`) return React/SVG elements.
Features are serialized as JSON for transport and reconstructed on the client,
where the React component renders them.

**Canvas-based renderers** (e.g. `PileupRenderer`, `WiggleBaseRenderer`) draw to
an `OffscreenCanvas` and transfer the resulting `ImageBitmap` back to the
client. Features are consumed during rendering and not returned.

For creating a renderer, see
[creating renderers](/docs/developer_guides/creating_renderer).
