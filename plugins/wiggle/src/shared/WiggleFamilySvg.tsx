import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { CrossHatchLines, axisPlotBox } from '@jbrowse/wiggle-core'

import { legendRightEdgePx } from './wiggleComponentUtils.ts'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { LgvSvgBodyProps } from '@jbrowse/plugin-linear-genome-view'
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
  showCrossHatches: boolean
}

// Canvas geometry handed to the paint callback. The caller builds its own
// render-state from this plus its `model.renderState` (keeping the concrete
// type), so the scaffold stays agnostic to the per-display render-state shape.
export interface WiggleFamilySvgLayout {
  canvasWidth: number
  drawHeight: number
  renderBlocks: RenderBlock[]
}

/**
 * x a left-oriented y-axis is anchored at (the content's left edge). Non-zero
 * only when scrolled before genome start. Left-oriented so the labels grow into
 * the export margin rather than over the plot — the on-screen axis instead
 * indents by ONSCREEN_AXIS_LEFT_PX and grows rightward.
 */
export function svgScalebarLeftPx(view: { offsetPx: number }) {
  return Math.max(-view.offsetPx, 0)
}

/**
 * x a right-aligned legend is pinned to: the content's right edge, not the
 * viewport's. At whole-genome zoom the regions can end before it, and a legend
 * parked out in the empty gutter reads as detached from the plot.
 */
export function svgLegendRightPx(
  view: { visibleRegions: { screenEndPx: number }[] },
  canvasWidth: number,
) {
  return legendRightEdgePx(view.visibleRegions, canvasWidth)
}

// Shared SVG-export body for the single-plot wiggle-family displays
// (LinearWiggleDisplay, GWAS Manhattan), mounted by each display's own body
// through `renderDisplaySvg`. Owns the parts that must stay pixel-aligned with
// the on-screen canvas — the clip rect + YSCALEBAR_LABEL_OFFSET translate, the
// PaintLayer sizing, and the cross-hatch overlay. The caller supplies only its
// paint (draws the data onto a 2D context) and an optional legend/axis element.
//
// MultiLinearWiggleDisplay deliberately does NOT use this: it stacks rows
// edge-to-edge over the full height with no YSCALEBAR_LABEL_OFFSET inset (see
// its `renderState`), so it keeps its own body. Don't "unify" them without
// first parameterizing the inset.
export function WiggleFamilySvgFrame({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
  clipIdPrefix,
  paint,
  legend,
}: LgvSvgBodyProps<WiggleFamilySvgModel> & {
  clipIdPrefix: string
  paint: (ctx: Ctx2D, layout: WiggleFamilySvgLayout) => void
  legend?: React.ReactNode
}) {
  // the plot itself is inset by the scalebar label gutter at top and bottom, so
  // it never overlaps the axis labels drawn in those bands — the same box
  // `ticks` places itself in, which is why both read it from one helper
  const plotBox = axisPlotBox(height)
  const drawHeight = plotBox.plotHeight
  const { ticks, showCrossHatches } = model
  return (
    <>
      <SvgClipRect
        id={`${clipIdPrefix}-clip-${model.id}`}
        width={canvasWidth}
        height={height}
      >
        <g transform={`translate(0,${plotBox.yTop})`}>
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
      {showCrossHatches && ticks ? (
        <CrossHatchLines ticks={ticks} width={canvasWidth} />
      ) : null}
      {legend}
    </>
  )
}
