import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { axisPlotBox } from '@jbrowse/wiggle-core'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type React from 'react'

// The display fields the shared SVG scaffold reads. LinearWiggleDisplay,
// MultiLinearWiggleDisplay and LinearManhattanDisplay all satisfy this
// (`error`/`regionTooLarge`/`svgReady` come from SvgExportable); each supplies
// its own paint. The axis and the cross-hatches are the shell's
// (`renderDisplaySvg`), off the display's `valueScales`.
export interface WiggleFamilySvgModel extends SvgExportable {
  id: string
  height: number
}

// Canvas geometry handed to the paint callback. The caller builds its own
// render-state from this plus its `model.renderState` (keeping the concrete
// type), so the scaffold stays agnostic to the per-display render-state shape.
export interface WiggleFamilySvgLayout {
  canvasWidth: number
  drawHeight: number
  renderBlocks: RenderBlock[]
}

// Shared SVG-export body for every wiggle-family display, mounted by each
// display's own body through `renderDisplaySvg`. Owns the parts that must stay
// pixel-aligned with the on-screen canvas — the clip rect + plot-box translate,
// the PaintLayer sizing. The caller supplies only its paint (draws the data
// onto a 2D context) and an optional legend element.
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
}: LgvSvgBodyProps<WiggleFamilySvgModel> & {
  clipIdPrefix: string
  plotGeometry?: { yTop: number; plotHeight: number }
  paint: (ctx: Ctx2D, layout: WiggleFamilySvgLayout) => void
  legend?: React.ReactNode
  overlay?: React.ReactNode
}) {
  const { yTop, plotHeight } = plotGeometry
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
      {/* Annotations drawn on the plot rather than in it, in the same
          un-translated space the shell's cross-hatches use: a y computed from
          `axisPlotBox` already carries the label-gutter inset. */}
      {overlay}
      {legend}
    </>
  )
}
