import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawAlignmentsToCtx } from './components/Canvas2DAlignmentsRenderer.ts'
import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import YScaleBar from './components/YScaleBar.tsx'
import { computePileupBezierArcs } from './components/computePileupArcs.ts'
import { computeSashimiArcs } from './components/sashimiArcs.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const theme = createJBrowseTheme(opts?.theme)
  const view = getContainingView(model) as LGV
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

  const {
    laidOutPileupMap: rpcDataMap,
    showCoverage,
    coverageHeight,
    coverageTicks,
    arcsRpcDataMap,
    showSashimiArcs,
    sashimiArcsDown,
    sashimiArcsHeight,
    showLinkedReads,
    showLinkedReadsAsBeziers,
    featureHeightSetting,
    featureSpacing,
    coverageDisplayHeight,
    pileupViewportHeight,
  } = model

  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const totalWidth = view.totalWidthPx
  const displayHeight = model.height

  // SVG export renders the full display from y=0 with no Y scroll. Reuse the
  // model's renderState — only viewport-related fields are overridden.
  const state = {
    ...baseState,
    rangeY: [0, displayHeight] as [number, number],
    canvasWidth: totalWidth,
    canvasHeight: displayHeight,
  }
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const pileupNode = paintLayer(totalWidth, displayHeight, opts, ctx => {
    drawAlignmentsToCtx(
      ctx,
      { laidOutPileupMap: rpcDataMap, arcsRpcDataMap },
      renderBlocks,
      state,
    )
  })

  // Sashimi: vector SVG by design (low arc count + native hover behavior in
  // the on-screen overlay). Geometry/color/strokeWidth come from the same
  // `computeSashimiArcs` the overlay uses, so export matches what users see.
  // Sort by score so high-count arcs paint on top of low-count ones, mirroring
  // the overlay's z-order.
  let sashimiNode: React.ReactNode = null
  if (showSashimiArcs && showCoverage) {
    const arcs = computeSashimiArcs({
      rpcDataMap,
      visibleRegions: view.visibleRegions,
      bpToScreenX: (refName, bp) => {
        const r = view.bpToPx({ refName, coord: bp })
        return r === undefined ? undefined : r.offsetPx - offsetPx
      },
      coverageHeight,
      sashimiArcsHeight,
      sashimiArcsDown,
    })
    arcs.sort((a, b) => a.score - b.score)
    const sashimiTopOffset = sashimiArcsDown
      ? coverageHeight
      : YSCALEBAR_LABEL_OFFSET
    sashimiNode = (
      <g transform={`translate(0,${sashimiTopOffset})`}>
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            fill="none"
          />
        ))}
      </g>
    )
  }

  // Mirrors the sashimi block: bezier curves (and cross-region straights)
  // come from the same `computePileupBezierArcs` the on-screen overlay uses,
  // so SVG export matches what users see.
  let pileupBezierNode: React.ReactNode = null
  if (showLinkedReads && showLinkedReadsAsBeziers) {
    const arcs = computePileupBezierArcs({
      laidOutPileupMap: rpcDataMap,
      displayedRegions: view.displayedRegions,
      bpToScreenX: (refName, bp) => {
        const r = view.bpToPx({ refName, coord: bp })
        return r === undefined ? undefined : r.offsetPx - offsetPx
      },
      featureHeight: featureHeightSetting,
      featureSpacing,
      pileupTopOffset: coverageDisplayHeight,
      rangeY: [0, displayHeight],
      viewportH: pileupViewportHeight,
    })
    pileupBezierNode = (
      <g style={{ pointerEvents: 'none' }}>
        {arcs.map((arc, i) => (
          <path
            key={i}
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

  const separatorColor = theme.palette.grey[500]

  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={view.width}
        height={displayHeight}
      >
        {pileupNode}
        {showCoverage ? (
          <line
            x1={0}
            y1={coverageHeight}
            x2={totalWidth}
            y2={coverageHeight}
            stroke={separatorColor}
            strokeWidth={1}
          />
        ) : null}
        {sashimiNode}
        {pileupBezierNode}
      </SvgClipRect>
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${scalebarLeft})`}>
          <CoverageYScaleBar model={model} orientation="left" />
        </g>
      ) : null}
      {model.insertSizeTicks ? (
        // 50 matches the on-screen SVG width for the insert-size scale bar
        <g transform={`translate(${totalWidth - 50})`}>
          <YScaleBar ticks={model.insertSizeTicks} orientation="right" />
        </g>
      ) : null}
    </>
  )
}
