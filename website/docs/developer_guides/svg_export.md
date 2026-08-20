---
title: SVG export
description: How to implement renderSvg on a custom display type
guide_category: Plugins
---

**TL;DR:** implement `renderSvg()` on your display by returning
`renderDisplaySvg(model, opts, YourSvgBody)` and painting through `PaintLayer`.
It is optional — a display without one is left out of the export, and the user
is told which tracks were left out.

The Linear Genome View's `exportSvg()` action calls each visible display's
`renderSvg()`, collecting the returned React nodes and rendering them into a
server-side SVG via `renderToSvg`.

A display that implements no `renderSvg` is dropped from the export the same way
a minimized track is, and dropped at the same point — before the legend is
measured and before the height is reserved, so it leaves no labelled gap where
the track would have been. The export notifies the session once, naming the
tracks it left out and why.

So a display type that never implements one costs itself a place in people's
figures, and costs the rest of the session nothing. Write one if you want your
display in the picture.

## PaintLayer

`PaintLayer` from `@jbrowse/core/util/paintLayer` drives both on-screen and
export drawing from one callback. It is a **component**, not a function — it
renders either an `<image>` or a `<g>`, and callers don't branch on which:

<!-- include: packages/core/src/util/paintLayer.tsx -->

```tsx
import { SvgCanvas } from './SvgCanvas.ts'
import { createSvgRasterCanvas } from './createSvgRasterCanvas.ts'

import type { SvgRasterCanvasOpts } from './createSvgRasterCanvas.ts'
import type React from 'react'

// Shared 2D-context type for the SVG-export draw pipeline. Real
// CanvasRenderingContext2D when rasterizing to PNG; SvgCanvas when emitting
// vector. Most plugin draw functions duck-type against this union.
export type Ctx2D = CanvasRenderingContext2D | SvgCanvas

export type PaintLayerOpts = SvgRasterCanvasOpts & {
  rasterizeLayers?: boolean
}

/**
 * Paint into either a 2× rasterize canvas (PNG-embedded as <image>) or an
 * SvgCanvas (serialized into a <g>). Renders one element — callers don't
 * branch on which mode was picked.
 *
 * Used by every renderSvg.tsx that has a heavy draw path: the same `paint`
 * callback runs on both surfaces, with `paint(ctx)` doing whatever drawing
 * the plugin needs in logical coordinates (the raster canvas is pre-scaled, so
 * callbacks never deal with devicePixelRatio). Width 0 or height 0 falls
 * through to the vector branch (canvas creation rejects 0×0).
 *
 * A vector layer whose `paint` drew nothing renders nothing — not an empty
 * `<g>`. Layers are routinely conditional on data (a highlight pass with no
 * highlighted feature, a legend-less track, a band that is switched off), and
 * every such layer was leaving a stray group in the file for a reader to open
 * and find empty. The raster branch has no cheap equivalent — asking whether a
 * canvas is blank means reading its pixels back — and it does not need one: a
 * fully transparent PNG is a couple of hundred bytes.
 */
export function PaintLayer({
  width,
  height,
  opts,
  paint,
}: {
  width: number
  height: number
  opts?: PaintLayerOpts
  paint: (ctx: Ctx2D) => void
}): React.ReactNode {
  if (opts?.rasterizeLayers && width > 0 && height > 0) {
    const { canvas, ctx } = createSvgRasterCanvas(width, height, opts)
    paint(ctx)
    return (
      <image
        width={width}
        height={height}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  }
  const svg = new SvgCanvas()
  paint(svg)
  const markup = svg.getSerializedSvg()
  return markup ? (
    // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
    <g dangerouslySetInnerHTML={{ __html: markup }} />
  ) : null
}
```

With `opts.rasterizeLayers` set it draws to an offscreen 2x canvas and embeds a
PNG; otherwise it draws to `SvgCanvas`, a `CanvasRenderingContext2D` duck-type
emitting `<rect>`, `<text>`, `<path>`. Pass `undefined` for `opts` to force
vector output; do that for text and labels so they stay crisp.

Anything draw-shaped should go through it. Hand-rolled
`<rect>`/`<path>`/`<line>` is a red flag, the exceptions being trivial chrome
and React-SVG overlays shared with the on-screen path.

## Implementing renderSvg

### Create `renderSvg.tsx`

Every LGV `renderSvg` is the same shape, and the shape is a function call:
`renderDisplaySvg(model, opts, YourSvgBody)`. The shell awaits readiness,
resolves the view geometry once, and mounts the terminal-state gate around your
body — so **do not** write `when(() => ...)`, an `if (model.error) return`, or
an `SvgChrome` of your own. `Body` is a component rather than a callback
precisely so it never runs in a terminal state.

A display whose data failed to load fails the whole export: the export dialog
shows the error and saves nothing, rather than writing a figure with the error
drawn into it. The one terminal an export does draw is "region too large", which
is a state the user navigated to on purpose.

`LinearReferenceSequenceDisplay` is the whole pattern in one file:

<!-- include: plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx -->

```tsx
import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'

import { drawSequenceBlocks } from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'

import type { DrawSequenceState } from './components/drawSequence.ts'
import type { SequenceRegionData } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
  SvgExportable,
} from '@jbrowse/plugin-linear-genome-view'

interface SequenceDisplayModel extends SvgExportable {
  id: string
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderState: DrawSequenceState
  // terminal static-message state (zoomed past base resolution, or every row
  // toggled off), folded into svgReady via fetchInert; still read
  // here to skip painting bases
  placeholderMessage: string | undefined
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, SequenceSvgBody)
}

function SequenceSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<SequenceDisplayModel>) {
  const { sequenceData } = model
  // the terminal static-message state (no fetch); an empty but loaded
  // sequenceData still paints naturally below.
  if (model.placeholderMessage) {
    return null
  }

  // The export theme can differ from the session theme, so rebuild the palette
  // here and reuse the rest of the live renderState.
  const state: DrawSequenceState = {
    ...model.renderState,
    // canvasWidth is the block scissor bound, so it has to be the width this
    // layer is actually painted at — see LgvSvgBodyProps.canvasWidth.
    canvasWidth,
    palette: buildColorPalette(
      resolvePalette({ configTheme: opts?.theme }),
      view.colorByCDS,
    ),
  }

  // Sequence is text-heavy; routed through PaintLayer so rasterizeLayers can
  // PNG-embed when set, but the default (vector) path keeps letters crisp.
  return (
    <SvgClipRect
      id={`sequence-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawSequenceBlocks(ctx, sequenceData, renderBlocks, state)
        }}
      />
    </SvgClipRect>
  )
}
```

### Add the action to your display model

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#renderSvgAction -->

```ts
/**
 * #action
 * Dynamic import so the export path — and everything it pulls in — stays
 * out of the bundle until someone actually exports.
 */
async renderSvg(opts: ExportSvgDisplayOptions) {
  const { renderSvg } = await import('./renderSvg.tsx')
  return renderSvg(self as LinearMafDisplayModel, opts)
},
```

## Coordinate system

Paint at the `canvasWidth` the shell hands your body, never at
`model.renderState.canvasWidth`. The on-screen render state carries
`view.trackWidthPx` — `view.width` minus the 2px track outline the export does
not draw — and that same number is the block scissor bound, so painting an
export at it clips the rightmost 2px column of content inside a `view.width`
frame. `LinearMultiRowFeatureDisplay` shipped exactly that bug. A body reusing
`model.renderState` has to override `canvasWidth` with the prop, as the sequence
body above does.

The Y axis runs 0 (top) to `model.height` (bottom), same as on-screen.
Horizontal placement comes from `renderBlocks`, which gives `{ startPx, endPx }`
per region: take it off the body's props — `renderDisplaySvg` resolves
`buildRenderBlocks(view.visibleRegions)` once, for the same reason it resolves
`canvasWidth` — rather than calling `buildRenderBlocks` again yourself.
(`MultiRegionDisplayMixin` exposes a `renderBlocks` getter of the same
expression, for the on-screen path.)

Clip-path ids must be scoped by the owning model's `.id` — SVG ids are
document-global, and a duplicate renders the second group unclipped.

## Reusing on-screen drawing code

This is the rule the whole pipeline rests on: **the GPU shader path is an
accelerator, the Canvas2D draw function is the source of truth, and SVG export
runs it.** A shader-only tweak therefore cannot silently diverge the export.

Write drawing functions against `Ctx2D` and call them from both the on-screen
renderer and `renderSvg` — the sequence body above calls the same
`drawSequenceBlocks` its Canvas2D renderer does:

<!-- include: packages/core/src/util/paintLayer.tsx#ctx2d -->

```ts
// Shared 2D-context type for the SVG-export draw pipeline. Real
// CanvasRenderingContext2D when rasterizing to PNG; SvgCanvas when emitting
// vector. Most plugin draw functions duck-type against this union.
export type Ctx2D = CanvasRenderingContext2D | SvgCanvas
```

## Reference examples

Simplest to most complex:

- `plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx` - text
  only
- `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` - score plot with scale
  bar
- `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` - features + labels
  layers
- `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` - coverage,
  pileup, arcs

## See also

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/creating_gpu_display)
- [SVG_EXPORT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SVG_EXPORT.md)
  — the pipeline behind this page: the `svgReady`/`settled` readiness gates an
  export waits on, and how clip ids are kept unique across displays
