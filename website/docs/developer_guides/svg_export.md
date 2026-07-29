---
title: SVG export
description: How to implement renderSvg on a custom display type
guide_category: Pluggable elements
---

**TL;DR:** implement `renderSvg()` on your display, drawing layers with
`paintLayer`; displays without it are skipped by "Export SVG".

The Linear Genome View's `exportSvg()` action calls each visible display's
`renderSvg()`, collecting the returned React nodes and rendering them into a
server-side SVG via `renderToSvg`.

## paintLayer

`paintLayer` from `@jbrowse/core/util/paintLayer` drives both on-screen and
export drawing from one callback:

```ts
import { paintLayer } from '@jbrowse/core/util/paintLayer'

// ctx is CanvasRenderingContext2D | SvgCanvas — one callback, both targets.
const node = paintLayer(width, height, opts, ctx => {
  ctx.fillStyle = '#f00'
  ctx.fillRect(x, y, w, h)
})
```

With `opts.rasterizeLayers` true it draws to an offscreen canvas and embeds a
`<image>` PNG; otherwise it draws to `SvgCanvas`, a `CanvasRenderingContext2D`
duck-type emitting `<rect>`, `<text>`, `<path>`. Pass `undefined` for `opts` to
force vector output — always do this for text and labels so they stay crisp.

## Implementing renderSvg

### Create `renderSvg.tsx`

```tsx
import { when } from 'mobx'
import { getContainingView } from '@jbrowse/core/util'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { YourDisplayModel } from '../model'

export async function renderSvg(
  model: YourDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  const view = getContainingView(model) as LinearGenomeViewModel

  await when(() => model.svgReady || !!model.error)

  if (!model.svgReady) {
    return null
  }

  const theme = createJBrowseTheme(opts?.theme)
  const width = view.totalWidthPx
  const height = model.height

  // Features can be rasterized; labels stay vector so text is sharp.
  const featuresNode = paintLayer(width, height, opts, ctx => {
    drawYourFeatures(ctx, model.data, { width, height, theme })
  })
  const labelsNode = paintLayer(width, height, undefined, ctx => {
    drawYourLabels(ctx, model.data, { width, height, theme })
  })

  return (
    <SvgClipRect
      id={`yourdisplay-clip-${model.id}`}
      width={view.width}
      height={height}
    >
      {featuresNode}
      {labelsNode}
    </SvgClipRect>
  )
}
```

### Add the action to your display model

```ts
.actions(self => ({
  async renderSvg(opts?: ExportSvgDisplayOptions) {
    const { renderSvg } = await import('./renderSvg.tsx')
    return renderSvg(self as YourDisplayModel, opts)
  },
}))
```

## Coordinate system

SVG export renders the entire visible span, not the scrolled viewport, so the
coordinate space differs from on-screen rendering:

- `view.totalWidthPx` - canvas width across all visible regions (use this, not
  `view.width`, which is the viewport width)
- `view.visibleRegions` - list of displayed regions
- Y axis runs 0 (top) to `model.height` (bottom), same as on-screen

`buildRenderBlocks(view.visibleRegions)` from `@jbrowse/render-core/renderBlock`
gives `{ startPx, endPx }` per region, mapping genomic coordinates into export
pixels. The display also exposes a `renderBlocks` getter via
`MultiRegionDisplayMixin`.

## Reusing on-screen drawing code

Write drawing functions against the `Ctx2D` type
(`CanvasRenderingContext2D | SvgCanvas`, from `@jbrowse/core/util/paintLayer`)
and call them from both the on-screen renderer and `renderSvg`. Alignments,
canvas-features, and wiggle displays all do this:

```ts
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawFeatures(ctx: Ctx2D, data: FeatureData, opts: DrawOpts) {
  for (const feat of data.features) {
    ctx.fillStyle = opts.theme.palette.primary.main
    ctx.fillRect(feat.x, feat.y, feat.width, feat.height)
  }
}
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

- [Creating custom display types](/docs/developer_guides/creating_display)
- [Creating a GPU-accelerated display](/docs/developer_guides/creating_gpu_display)
