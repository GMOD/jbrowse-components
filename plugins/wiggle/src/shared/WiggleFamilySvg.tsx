import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { CrossHatchLines, YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

import { legendRightEdgePx } from './wiggleComponentUtils.ts'

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

// Layout values a legend/axis needs. The scaffold supplies only the shared
// positions; each display spreads these into its own legend component (which
// reads its model for domain/scaleType/mode).
export interface WiggleFamilySvgLegendInfo {
  // x a left-oriented y-axis is anchored at (the content's left edge)
  scalebarLeft: number
  // x a right-aligned legend is pinned to (the content's right edge, which at
  // whole-genome zoom stops short of the viewport)
  legendRight: number
  ticks: YScaleTicks | undefined
}

// Shared SVG-export scaffold for the single-plot wiggle-family displays
// (LinearWiggleDisplay, GWAS Manhattan). Owns the parts that must stay
// pixel-aligned with the on-screen canvas — the SvgChrome frame, the clip rect +
// YSCALEBAR_LABEL_OFFSET translate, the PaintLayer sizing, and the cross-hatch
// overlay. The caller supplies only its paint (draws the data) and an optional
// legend/axis tree.
//
// MultiLinearWiggleDisplay deliberately does NOT use this: it stacks rows
// edge-to-edge over the full height with no YSCALEBAR_LABEL_OFFSET inset (see
// its `renderState`), so it keeps its own scaffold. Don't "unify" them without
// first parameterizing the inset.
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
  const height = model.height
  // anchors scale bars to the left edge of content; non-zero only when scrolled
  // before genome start. Left-oriented, so the labels grow into the export
  // margin rather than over the plot (the on-screen axis instead indents by
  // ONSCREEN_AXIS_LEFT_PX and grows rightward).
  const scalebarLeft = Math.max(-view.offsetPx, 0)
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  // right-aligned legends pin to the content's right edge, not the viewport's:
  // at whole-genome zoom the regions can end before it, and a legend parked out
  // in the empty gutter reads as detached from the plot
  const legendRight = legendRightEdgePx(view.visibleRegions, canvasWidth)
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // the plot itself is inset by the scalebar label gutter at top and bottom, so
  // it never overlaps the axis labels drawn in those bands
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
      {legend?.({ scalebarLeft, legendRight, ticks })}
    </SvgChrome>
  )
}
