---
title: SVG export
description: How to implement renderSvg on a custom display type
guide_category: Plugins
---

Implement `renderSvg()` on your display by returning
`renderDisplaySvg(model, opts, YourSvgBody)` and painting through `MarkSvgLayer`
or `PaintLayer`. It is optional — a display without one is left out of the
export, and the user is told which tracks were left out.

The Linear Genome View's `exportSvg()` action calls each visible display's
`renderSvg()`, collecting the returned React nodes and rendering them into a
server-side SVG via `renderToSvg`.

A display that implements no `renderSvg` is dropped from the export the same way
a minimized track is, and dropped at the same point — before the legend is
measured and before the height is reserved, so it leaves no labelled gap where
the track would have been. The export notifies the session once, naming the
tracks it left out and why. The rest of the export proceeds normally, so a
display type that never implements one is absent from the figure.

## PaintLayer

`PaintLayer` from `@jbrowse/core/util/paintLayer` drives both on-screen and
export drawing from one callback. It is a **component** rendering either an
`<image>` or a `<g>`, and callers don't branch on which:

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
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
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

The surface comes from `opts`:

- With `opts.rasterizeLayers` set it draws to an offscreen 2x canvas and embeds
  a PNG.
- Otherwise it draws to `SvgCanvas`, a `CanvasRenderingContext2D` duck-type
  emitting `<rect>`, `<text>`, `<path>`. Pass `undefined` for `opts` to force
  this vector output; do that for text and labels so they stay crisp.

Anything draw-shaped should go through it. Hand-rolled
`<rect>`/`<path>`/`<line>` usually means the code should go through `PaintLayer`
instead, the exceptions being trivial chrome and captions such as tree labels.

A display on the mark layer paints through `MarkSvgLayer` from
`@jbrowse/display-kit/MarkSvgLayer`, a `PaintLayer` that runs a mark list over
the render blocks. It frames the state at the layer's own `width` and `height`,
and its optional `paint` callback draws the overlays the screen stacks over its
canvas, with that same framed state.

## Implementing renderSvg

### Create `renderSvg.tsx`

Every LGV `renderSvg` is the same shape, and the shape is a function call:
`renderDisplaySvg(model, opts, YourSvgBody)`. The shell awaits readiness,
resolves the view geometry once, and mounts the terminal-state gate around your
body — so **do not** write `when(() => ...)`, an `if (model.error) return`, or
an `SvgChrome` of your own. `Body` is a component so that it never runs in a
terminal state.

A display whose data failed to load fails the whole export: the export dialog
shows the error and saves nothing. The one terminal an export does draw is
"region too large", which is a state the user navigated to on purpose.

`LinearReferenceSequenceDisplay` is the whole pattern in one file:

<!-- include: plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx -->

```tsx
/* eslint-disable react-refresh/only-export-components */
import { SVGMessageBox } from '@jbrowse/core/svg/SvgExport'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { drawSequenceLetters } from './components/drawSequenceLetters.ts'
import { encodeSequenceCells } from './components/sequenceCells.ts'
import { SEQUENCE_MARKS } from './components/sequenceMarks.ts'

import type {
  ColorPalette,
  SequenceRenderState,
} from './components/sequenceGeometry.ts'
import type { SequenceRegionData } from './model.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface SequenceDisplayModel extends LgvSvgExportable {
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderState: SequenceRenderState
  colorPaletteIn: (palette: JBrowsePalette) => ColorPalette
  placeholderMessage: string | undefined
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, SequenceSvgBody)
}

// Where the screen shows its placeholder — zoomed out, or every row off — the
// export says so too, as it says a region is too large.
function SequenceSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<SequenceDisplayModel>) {
  const palette = usePalette()
  const { sequenceData, placeholderMessage } = model
  if (placeholderMessage) {
    return (
      <SVGMessageBox
        message={placeholderMessage}
        width={canvasWidth}
        height={height}
      />
    )
  }
  const state = { ...model.renderState, palette: model.colorPaletteIn(palette) }
  const cells = new Map(
    [...sequenceData].map(([key, data]) => [
      key,
      encodeSequenceCells(data, state, !!view.displayedRegions[key]?.reversed),
    ]),
  )
  return (
    <MarkSvgLayer
      marks={SEQUENCE_MARKS}
      regions={cells}
      blocks={renderBlocks}
      state={state}
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={(ctx, framed) => {
        drawSequenceLetters(ctx, sequenceData, renderBlocks, framed)
      }}
    />
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
`model.renderState.canvasWidth`. The on-screen render state has
`view.trackWidthPx` — `view.width` minus the 2px track outline the export does
not draw — and that same number is the block scissor bound, so painting an
export at it clips the rightmost 2px column of content inside a `view.width`
frame. `LinearMultiRowFeatureDisplay` shipped exactly that bug. `MarkSvgLayer`
replaces the state's canvas box with the `width` and `height` you pass it, so
the sequence body above spreads `model.renderState` without overriding
`canvasWidth`. A body calling `PaintLayer` directly has to override it itself.

The Y axis runs 0 (top) to `model.height` (bottom), same as on-screen.
Horizontal placement comes from `renderBlocks`, which gives `{ startPx, endPx }`
per region: take it off the body's props, where `renderDisplaySvg` has resolved
`buildRenderBlocks(view.visibleRegions)` once, for the same reason it resolves
`canvasWidth`. (`MultiRegionDisplayMixin` exposes a `renderBlocks` getter of the
same expression, for the on-screen path.)

Clip-path ids must be scoped by the owning model's `.id` — SVG ids are
document-global, and a duplicate renders the second group unclipped.

## Colors, fonts and live figures

The export dialog picks its own theme and font, which need not be the ones the
session shows. A body reads colors from `usePalette()`, never from the session.
When a model input is built from the theme, give it a twin that takes the
palette and call that from the body; the sequence display's `colorPaletteIn`
above is one, beside the `colorPalette` getter the screen reads. The legend
works the same way: a display whose key takes colors from the theme overrides
`LegendMixin`'s `colorScalesIn(palette)`, and the exported key is drawn from it.

The dialog sets `font-family` on the root `<svg>`, so a `<text>` should leave
the attribute off and inherit it. Measure labels in `opts.fontFamily`.

A live figure (`useViewSvgFigure`) mounts the export in a page and freezes it
against one snapshot of the model. Draw overlays as plain components that read
the model once: an `observer` used on screen follows the view, so a pan slides
its labels across layers drawn before it.

A figure carries a pinned highlight but never a hover or a selection, since both
only say where the reader's pointer was. A body passing the screen's render
state to a painter clears the hovered and selected ids first.

## Reusing on-screen drawing code

**The GPU shader path is an accelerator, the Canvas2D painter is the source of
truth, and SVG export runs it.** A shader-only tweak therefore leaves the export
unchanged.

A display on the mark layer gets this for nothing: `MarkSvgLayer` runs each
mark's `paintBlock` against the SVG context, so its body is one component over
the same list the on-screen backend draws —
`example-plugins/score-example/src/LinearScoreDisplay/renderSvg.tsx` is the
whole of one. Drawing that is not a shape is a function written against `Ctx2D`
and called from both the on-screen layer and `renderSvg` — the sequence body
above calls the same `drawSequenceLetters` its letters overlay does:

<!-- include: packages/core/src/util/paintLayer.tsx#ctx2d -->

```ts
// Shared 2D-context type for the SVG-export draw pipeline. Real
// CanvasRenderingContext2D when rasterizing to PNG; SvgCanvas when emitting
// vector. Most plugin draw functions duck-type against this union.
export type Ctx2D = CanvasRenderingContext2D | SvgCanvas
```

## Reference examples

Simplest to most complex:

- `plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx` - marks
  and a letters layer
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
