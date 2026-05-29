import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { drawAlignmentsToCtx } from './components/Canvas2DAlignmentsRenderer.ts'
import TlenAxisLabel from './components/TlenAxisLabel.tsx'
import { makeBpToScreenX } from './components/alignmentComponentUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { computePileupBezierArcsFromModel } from './components/pileupBezierArcs.ts'
import { computeSashimiArcs } from '../features/sashimi/computeOverlay.ts'
import { getContrastBaseMap } from '../shared/util.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const theme = createJBrowseTheme(opts?.theme)
  const view = getContainingView(model) as LinearGenomeViewModel
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const baseState = model.renderState
  if (!baseState || model.laidOutPileupMap.size === 0) {
    return null
  }

  const totalWidth = view.totalWidthPx
  const displayHeight = model.height
  const fullRangeY: [number, number] = [0, displayHeight]
  const renderBlocks = buildRenderBlocks(view.visibleRegions)

  // SVG export renders the full display from y=0 with no Y scroll. Reuse the
  // model's renderState — only viewport-related fields are overridden.
  const state = {
    ...baseState,
    rangeY: fullRangeY,
    canvasWidth: totalWidth,
    canvasHeight: displayHeight,
  }

  // Same compute as the on-screen getter; only rangeY differs (SVG export
  // shows the full track height regardless of Y scroll).
  const labels = computeVisibleLabels({
    view,
    laidOutPileupMap: model.laidOutPileupMap,
    height: displayHeight,
    featureHeightSetting: model.featureHeightSetting,
    featureSpacing: model.featureSpacing,
    showMismatches: model.showMismatches,
    topOffset: model.coverageDisplayHeight,
    rangeY: fullRangeY,
  })
  const contrastMap = getContrastBaseMap(theme)
  const pileupNode = paintLayer(totalWidth, displayHeight, opts, ctx => {
    drawAlignmentsToCtx(
      ctx,
      {
        laidOutPileupMap: model.laidOutPileupMap,
        arcsRpcDataMap: model.arcsRpcDataMap,
      },
      renderBlocks,
      state,
    )
    drawAlignmentLabels(ctx, labels, contrastMap, theme)
  })

  // Sashimi: vector SVG by design (low arc count + native hover behavior in
  // the on-screen overlay). Geometry/colors come from the same
  // `computeSashimiArcs` the overlay uses; sorted by score so high-count arcs
  // paint on top, mirroring overlay z-order.
  const sashimiNode = renderSashimiArcs(model, view)
  const pileupBezierNode = renderPileupBezierArcs(model, view, fullRangeY)

  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={view.width}
        height={displayHeight}
      >
        {pileupNode}
        {model.showCoverage ? (
          <line
            x1={0}
            y1={model.coverageHeight}
            x2={totalWidth}
            y2={model.coverageHeight}
            stroke={theme.palette.grey[500]}
            strokeWidth={1}
          />
        ) : null}
        {sashimiNode}
        {pileupBezierNode}
      </SvgClipRect>
      {model.showCoverage && model.coverageTicks ? (
        // anchors scale bars to left edge of content; non-zero only when
        // scrolled before genome start
        <g transform={`translate(${Math.max(-view.offsetPx, 0)})`}>
          <YScaleBar ticks={model.coverageTicks} orientation="left" />
        </g>
      ) : null}
      {model.insertSizeTicks ? (
        // 50 matches the on-screen SVG width for the insert-size scale bar.
        // Down mode puts the TLEN scalebar on the left (matches PileupComponent).
        model.pairedConnectionsDown ? (
          <g transform="translate(45)">
            <YScaleBar ticks={model.insertSizeTicks} orientation="left" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
              x={6}
            />
          </g>
        ) : (
          <g transform={`translate(${totalWidth - 50})`}>
            <YScaleBar ticks={model.insertSizeTicks} orientation="right" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
            />
          </g>
        )
      ) : null}
    </>
  )
}

function renderSashimiArcs(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
): React.ReactNode {
  if (model.sashimiArcs === 'off' || !model.showCoverage) {
    return null
  }
  const isDown = model.sashimiArcs === 'down'
  const arcs = computeSashimiArcs({
    rpcDataMap: model.laidOutPileupMap,
    visibleRegions: view.visibleRegions,
    bpToScreenX: makeBpToScreenX(view),
    coverageHeight: model.coverageHeight,
    sashimiArcsHeight: model.sashimiArcsHeight,
    sashimiArcsDown: isDown,
  })
  arcs.sort((a, b) => a.score - b.score)
  const top = isDown ? model.coverageHeight : YSCALEBAR_LABEL_OFFSET
  return (
    <g transform={`translate(0,${top})`}>
      {arcs.map(arc => (
        <path
          key={`${arc.refName}:${arc.start}:${arc.end}`}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={arc.strokeWidth}
          fill="none"
        />
      ))}
    </g>
  )
}

function renderPileupBezierArcs(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  rangeY: [number, number],
): React.ReactNode {
  const arcs = computePileupBezierArcsFromModel(model, view, rangeY)
  if (!arcs.length) {
    return null
  }
  return (
    <g style={{ pointerEvents: 'none' }}>
      {arcs.map(arc => (
        <path
          key={`${arc.id1}:${arc.id2}`}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={1.5}
          strokeOpacity={0.8}
          fill="none"
        />
      ))}
    </g>
  )
}
