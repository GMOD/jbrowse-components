/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgTreePath } from '@jbrowse/tree-sidebar'

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import OverlayColorLegend from '../shared/OverlayColorLegend.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { legendRightEdgePx } from '../shared/wiggleComponentUtils.ts'
import MultiWiggleOverlayLines from './MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales from './MultiWiggleSvgScales.tsx'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: MultiLinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <MultiWiggleSvgBody
        model={model}
        view={view}
        height={height}
        opts={opts}
      />
    </SvgChrome>
  )
}

function MultiWiggleSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: MultiLinearWiggleDisplayModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  // anchors scale bars to left edge of content; non-zero only when scrolled
  // before genome start. Left-oriented, so the labels grow into the export
  // margin rather than over the plot (the on-screen axis instead indents by
  // ONSCREEN_AXIS_LEFT_PX and grows rightward).
  const scalebarLeft = Math.max(-view.offsetPx, 0)
  const { rpcDataMap, renderState } = model

  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot; the per-source
  // scales draw only where a real domain exists (MultiWiggleSvgScales).
  // Wiggle can't use the shared SvgTreeSidebar: its row labels live in
  // MultiWiggleSvgScales (shared with the on-screen path, alongside the
  // scalebars). So keep the split, but derive the label offset and the tree from
  // one `treeShowing` so a blank gutter can't appear.
  const { hierarchy, showTree, treeAreaWidth } = model
  const treeShowing = showTree && !!hierarchy

  const props = model.gpuProps()
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  // right-aligned legends pin to the content's right edge, not the viewport's:
  // at whole-genome zoom the regions can end before it, and a legend parked out
  // in the empty gutter reads as detached from the plot (same rule as on screen)
  const legendRight = legendRightEdgePx(view.visibleRegions, canvasWidth)
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth,
    canvasHeight: height,
  }

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={canvasWidth}
        height={height}
      >
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawWiggleToCtx(
              ctx,
              {
                rpcDataMap,
                encode: data => buildSourceRenderData(data, props),
              },
              renderBlocks,
              state,
            )
          }}
        />
      </SvgClipRect>
      {/* Row separators and Y-scale cross-hatches, shared with the on-screen
          path so an exported SVG matches the track when either is enabled. */}
      <MultiWiggleOverlayLines model={model} width={canvasWidth} />
      <MultiWiggleSvgScales
        model={model}
        legendRight={legendRight}
        scalebarLeft={scalebarLeft}
        labelOffset={treeShowing ? treeAreaWidth : 0}
      />
      {/* Overlay-mode color legend, drawn inline here. On screen this same
          legend is the hoisted MultiWiggleLegendOverlay instead (lifted above
          the inter-region masks, which the flat export SVG doesn't have); both
          read `hasOverlayLegend`, so a dismissed legend stays out of the
          export. */}
      {model.hasOverlayLegend ? (
        <OverlayColorLegend
          sources={model.sources}
          fallbackColor={model.posColor}
          canvasWidth={legendRight}
          maxHeight={height}
        />
      ) : null}
      {treeShowing ? <SvgTreePath hierarchy={hierarchy} /> : null}
    </>
  )
}
