import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { CrossHatchLines, YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { YScaleTicks } from '@jbrowse/wiggle-core'
import type React from 'react'

// The display fields the shared SVG scaffold reads. Both LinearWiggleDisplay and
// LinearManhattanDisplay satisfy this (`error`/`regionTooLarge`/`svgReady` come
// from SvgExportable); each supplies its own paint + legend.
export interface WiggleFamilySvgModel extends SvgExportable {
  id: string
  height: number
  ticks?: YScaleTicks
  displayCrossHatches: boolean
}

// Canvas geometry handed to the paint callback. The caller builds its own
// render-state from this plus its `model.renderState` (keeping the concrete
// type), so the scaffold stays agnostic to the per-display render-state shape.
export interface WiggleFamilySvgLayout {
  canvasWidth: number
  drawHeight: number
  renderBlocks: RenderBlock[]
}

// Layout values a legend/axis needs. The callback closes over its own model for
// domain/scaleType/mode, so the scaffold only supplies the shared positions.
export interface WiggleFamilySvgLegendInfo {
  scalebarLeft: number
  canvasWidth: number
  ticks: YScaleTicks | undefined
}

// Shared SVG-export scaffold for the wiggle-family displays (single/multi
// wiggle, GWAS Manhattan). Owns the parts that must stay pixel-aligned with the
// on-screen canvas — the SvgChrome frame, the clip rect + YSCALEBAR_LABEL_OFFSET
// translate, the PaintLayer sizing, and the cross-hatch overlay. The caller
// supplies only its paint (draws the data) and an optional legend/axis tree.
export async function renderWiggleFamilySvg({
  model,
  opts,
  clipIdPrefix,
  paint,
  legend,
}: {
  model: WiggleFamilySvgModel
  opts: ExportSvgDisplayOptions | undefined
  clipIdPrefix: string
  paint: (ctx: Ctx2D, layout: WiggleFamilySvgLayout) => void
  legend?: (info: WiggleFamilySvgLegendInfo) => React.ReactNode
}): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const height = opts?.overrideHeight ?? model.height
  // anchors scale bars to the left edge of content; non-zero only when scrolled
  // before genome start
  const scalebarLeft = Math.max(-view.offsetPx, 0)
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // drawHeight tracks the export height, not the on-screen one, so an
  // overrideHeight export scales the plot instead of drawing it at the display
  // height inside a taller/shorter frame
  const drawHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const { ticks, displayCrossHatches } = model
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <SvgClipRect
        id={`${clipIdPrefix}-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
          <PaintLayer
            width={canvasWidth}
            height={drawHeight}
            opts={opts}
            paint={ctx => {
              paint(ctx, { canvasWidth, drawHeight, renderBlocks })
            }}
          />
        </g>
      </SvgClipRect>
      {/* Y-scale cross-hatches, shared with the on-screen path so an exported
          SVG matches the track when the option is enabled. Tick y-positions
          already include YSCALEBAR_LABEL_OFFSET, aligning with the canvas group. */}
      {displayCrossHatches && ticks ? (
        <CrossHatchLines ticks={ticks} width={canvasWidth} />
      ) : null}
      {legend?.({ scalebarLeft, canvasWidth, ticks })}
    </SvgChrome>
  )
}
