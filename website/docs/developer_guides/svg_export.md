---
title: Adding SVG export to a display
description: How to implement renderSvg on a custom display type
guide_category: Creating pluggable elements
---

JBrowse's "Export SVG" feature calls `renderSvg()` on each visible display and
assembles the results into a single SVG file. Displays that don't implement it
are silently skipped.

## How it works

The Linear Genome View's `exportSvg()` action calls each display's `renderSvg()`
and collects the returned React nodes. Each node is rendered into a server-side
SVG document via `renderToSvg`.

The key utility is `paintLayer` from `@jbrowse/core/util/paintLayer`:

```ts
import { paintLayer } from '@jbrowse/core/util/paintLayer'

// In your draw callback, ctx is CanvasRenderingContext2D | SvgCanvas.
// The same paint function handles both on-screen canvas and SVG export.
const node = paintLayer(width, height, opts, ctx => {
  ctx.fillStyle = '#f00'
  ctx.fillRect(x, y, w, h)
})
```

When `opts.rasterizeLayers` is true, `paintLayer` draws to an offscreen canvas
and embeds the result as a `<image>` PNG in the SVG. When false it draws to
`SvgCanvas`, a `CanvasRenderingContext2D` duck-type that emits `<rect>`,
`<text>`, `<path>` etc. The same paint callback works for both.

Pass `undefined` instead of `opts` to force vector output regardless of user
preference — always do this for text and labels so they stay crisp.

## Implementing renderSvg

### 1. Create `renderSvg.tsx`

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

  // Wait until data is ready or an error is set
  await when(() => model.dataReady || !!model.error)

  if (!model.dataReady) {
    return null
  }

  const theme = createJBrowseTheme(opts?.theme)
  const width = view.totalWidthPx
  const height = model.height

  // Features layer — can be rasterized
  const featuresNode = paintLayer(width, height, opts, ctx => {
    drawYourFeatures(ctx, model.data, { width, height, theme })
  })

  // Labels layer — always vector so text stays sharp
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

### 2. Add the action to your display model

```ts
.actions(self => ({
  async renderSvg(opts?: ExportSvgDisplayOptions) {
    const { renderSvg } = await import('./renderSvg.tsx')
    return renderSvg(self as YourDisplayModel, opts)
  },
}))
```

## Coordinate system

SVG export renders the entire visible span, not just the scrolled viewport, so
the coordinate space differs slightly from on-screen rendering:

- `view.totalWidthPx` — total pixel width across all visible regions (use this
  as your canvas width, not `view.width` which is the viewport width)
- `view.visibleRegions` — list of displayed regions
- Y axis runs from 0 (top) to `model.height` (bottom), same as on-screen

Use `buildRenderBlocks(view.visibleRegions)` (imported from
`@jbrowse/core/gpu/renderBlock`) to get `{ startPx, endPx }` offsets per region
— these map genomic coordinates into pixels in the full export canvas. The
display model also exposes a `renderBlocks` getter via
`MultiRegionDisplayMixin`.

## Reusing on-screen drawing code

The recommended pattern is to write drawing functions that accept
`CanvasRenderingContext2D | SvgCanvas` as the context type (imported from
`@jbrowse/core/util/SvgCanvas`) and call them from both the on-screen renderer
and `renderSvg`. Alignments, canvas-features, and wiggle displays all do this.

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

From simplest to most complex:

- `plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx` — text
  only
- `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` — score plot with scale
  bar
- `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` — features + labels
  layers
- `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` — coverage,
  pileup, arcs
