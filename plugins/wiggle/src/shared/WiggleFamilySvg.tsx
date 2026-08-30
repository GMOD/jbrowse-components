import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { contentRightEdgePx } from '@jbrowse/display-kit/regionHost'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { CrossHatchLines, axisPlotBox } from '@jbrowse/wiggle-core'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { YScaleTicks } from '@jbrowse/wiggle-core'
import type React from 'react'

// The display fields the shared SVG scaffold reads. LinearWiggleDisplay,
// MultiLinearWiggleDisplay and LinearManhattanDisplay all satisfy this
// (`error`/`regionTooLarge`/`svgReady` come from SvgExportable); each supplies
// its own paint + legend.
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
  // Not `view.contentRightEdgePx`, which the on-screen path reads: that one is
  // clamped to the view's own `trackWidthPx`, and an export's canvas is its own
  // width. Same rule, this width.
  return contentRightEdgePx(view.visibleRegions, canvasWidth)
}

// Shared SVG-export body for every wiggle-family display, mounted by each
// display's own body through `renderDisplaySvg`. Owns the parts that must stay
// pixel-aligned with the on-screen canvas — the clip rect + plot-box translate,
// the PaintLayer sizing, and the cross-hatch overlay. The caller supplies only
// its paint (draws the data onto a 2D context) and an optional legend/axis
// element.
//
// `plotGeometry` is where the plot sits inside the display's own height, and is
// the whole of what the two wiggle displays disagree about: single-wiggle insets
// by the scalebar label gutter, multi-wiggle stacks rows edge-to-edge over the
// full height. It defaults to the single-plot box, which is what the Manhattan
// display (whose model has no `plotGeometry` getter) draws in.
export function WiggleFamilySvgFrame({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
  clipIdPrefix,
  plotGeometry = axisPlotBox(height),
  paint,
  legend,
  overlay,
  crossHatches,
}: LgvSvgBodyProps<WiggleFamilySvgModel> & {
  clipIdPrefix: string
  plotGeometry?: { yTop: number; plotHeight: number }
  paint: (ctx: Ctx2D, layout: WiggleFamilySvgLayout) => void
  legend?: React.ReactNode
  overlay?: React.ReactNode
  // The hatch overlay, for a display that rules more than one axis: multi-wiggle
  // repeats them per row, and passes its row separators through the same
  // element. Unset draws the single-plot set below.
  crossHatches?: React.ReactNode
}) {
  const { yTop, plotHeight } = plotGeometry
  const { ticks, showCrossHatches } = model
  return (
    <>
      <SvgClipRect
        id={`${clipIdPrefix}-clip-${svgNodeId(model)}`}
        width={canvasWidth}
        height={height}
      >
        <g transform={`translate(0,${yTop})`}>
          <PaintLayer
            width={canvasWidth}
            height={plotHeight}
            opts={opts}
            paint={ctx => {
              paint(ctx, { canvasWidth, drawHeight: plotHeight, renderBlocks })
            }}
          />
        </g>
      </SvgClipRect>
      {/* Y-scale cross-hatches, shared with the on-screen path so an exported
          SVG matches the track when the option is enabled. Tick y-positions
          already carry the plot box's own inset, aligning with the canvas group. */}
      {crossHatches ??
        (showCrossHatches && ticks ? (
          <CrossHatchLines ticks={ticks} width={canvasWidth} />
        ) : null)}
      {/* Annotations drawn on the plot rather than in it, in the same
          un-translated space the cross-hatches use: a y computed from
          `axisPlotBox` already carries the label-gutter inset. */}
      {overlay}
      {legend}
    </>
  )
}
