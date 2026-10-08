---
name: gpu-rendering
description: Where do I read about GPU rendering — which doc covers the display lifecycle and uploads, the backends, the HAL, or shaders and antialiasing — and what are the frame loop, the region key and the checklist for a new GPU display?
kind: spec
---

# GPU rendering architecture

How a display gets bytes onto the GPU and pixels onto the screen.
[ARCHITECTURE.md](../ARCHITECTURE.md) is the front door: read its **Display
stacks** and **Data fetching pipeline** first. This doc is the hub for the model
that has data and needs to draw it; the depth lives in the sibling docs below.

Everything here applies to displays that draw to a canvas. A display that paints
JSX SVG on both the on-screen and export paths composes none of it.

| Question | Doc |
|---|---|
| What does the mixin own, when does the scrim show, how does a lost context recover, how does an upload reach the GPU? | [GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md) |
| What does a plugin declare, why is Canvas2D the floor, how do the two backends stay in parity? | [GPU_BACKENDS.md](GPU_BACKENDS.md) |
| What does a HAL call do on WebGPU versus WebGL2, and which techniques does the path omit? | [GPU_HAL.md](GPU_HAL.md) |
| How is a shader authored, validated and antialiased? | [GPU_SHADERS.md](GPU_SHADERS.md) |
| What is a pass, a UBO, MSAA? | [GPU_GLOSSARY.md](GPU_GLOSSARY.md) |
| How many WebGL2 contexts, and what limits does a GPU guarantee? | [GPU_PORTABILITY.md](GPU_PORTABILITY.md) |

## Package map

`packages/render-core` holds the HAL, `RenderLifecycleMixin`, the backend base
classes and hooks; it is a leaf package (no `@jbrowse/core`), so a third-party
display can depend on it directly. `packages/display-kit/src/` holds
`MultiRegionDisplayMixin`, `GlobalFetchMixin` and `DisplayChrome`; shader codegen
is `packages/shader-tools/src/build-shaders.ts`. The host serves the GPU API to
runtime plugins like every bundled `@jbrowse` package
([ADR-128](../architecture-decision-records/adr-128-the-runtime-abi-is-the-exports-maps.md)).
The frame loop (`useRenderingBackend`, the upload and render autoruns) is
[GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md) §"The core contract".

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`, stable unless regions are added,
removed or reordered. **Not** an index into `dynamicBlocks.contentBlocks`: one
displayed region can yield several render blocks that share one GPU buffer and
draw with different scissor clips. It joins `model.rpcDataMap`,
`hal.uploadBuffer(regionKey, ...)` and `RenderBlock.displayedRegionIndex`. A
comparative display keys on `sharedBackendKey(self.id)` instead, and dotplot
rides that hash on the block's field, so the field is the key a block was
uploaded under, not always an index.

## Adding a new GPU display type

The public
[GPU displays guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
walks this checklist; keep it in step with any change here.

- **Shape** — `spanMark` or `pointMark` where one fits. Otherwise a `MarkShape`
  beside `my.slang` (`pnpm gen:shaders` emits `my.generated.ts`; `slangPass()`
  builds the descriptor) with its `writeUniforms`, its `paintBlock` (also the SVG
  export) and its `ink`, held to each other by a `sweepMarkAgainstHit` test.
- **Marks + backend** — `defineMark({ shape, channels, params })` per shape, and
  `createMarkBackend(canvas, MARKS)` from `@jbrowse/render-core/marks/backend`,
  imported from the lazily loaded component and nowhere else.
- **MST model**
  - `MultiRegionDisplayMixin()` for LGV-family per-region displays (brings
    `RenderLifecycleMixin`, `FetchMixin`, `RegionTooLargeMixin`, the fetch
    autoruns and `rpcProps()` wiring).
  - `GlobalFetchMixin()` for a single non-regional dataset (HiC, LD, multi-way
    synteny). It has **no** fetch autoruns; the display installs its own in
    `afterAttach` via `installGlobalFetchAutorun(self, { prepare, run, commit,
    delay, name })`. `prepare` runs synchronously and returning `undefined` is the
    display's gate, so what it read to decline stays tracked (HiC declines until
    `effectiveResolution` lands); `run` owns every await and writes nothing;
    `commit` writes while the fetch is still current.
  - `RenderLifecycleMixin()` directly only when neither fetch surface is needed.
  - A cached `renderState` view; `startRenderingBackend` calling `installUpload`
    (never a hand-rolled `attachRenderingBackend`); `rpcProps()`; `gpuProps()`
    only when the main thread encodes buffers from settings.
- **React component** — an `observer()` rendering `DisplayChrome` (from
  `@jbrowse/display-kit/DisplayChrome`) with `model`, the backend `factory` and a
  `testid`. It owns the overlays, so the component lays out only its canvas(es)
  via the render-prop child `({ canvasRef }) => <canvas ref={canvasRef} />`.
- **Wiggle-style displays** — compose `stateModelFactory` from the
  `LinearWiggleDisplay/stateModel` subpath, or only `WiggleScoreConfigMixin` +
  `makeScoreAxisMenuItem` and `ScorePlotChrome`. A zoom-independent display needs no
  cache override: the adapter's `zoomRange` is the zoom rule (ADR-125).
- **Tests** — unit (`MockHal`); browser (Puppeteer,
  `--backend=webgl|webgpu|canvas2d`).

