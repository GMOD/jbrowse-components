import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'


import {
  Canvas2DAlignmentsRenderer,
  drawAlignmentBlocks,
} from './components/Canvas2DAlignmentsRenderer.ts'
import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import YScaleBar from './components/YScaleBar.tsx'
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
    arcsState,
    showSashimiArcs,
    sashimiArcsDown,
    sashimiArcsHeight,
  } = model

  const { offsetPx } = view
  const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const displayHeight = model.height

  // Headless renderer: drive the same drawAlignmentBlocks pipeline used
  // on-screen. Upload region data, then paint into either a real canvas
  // (rasterize) or an SvgCanvas (vector). Coverage, indicators, paired arcs,
  // pileup reads, mismatches, soft/hard clips, modifications, and connecting
  // lines all flow through the unified pass.
  const renderer = new Canvas2DAlignmentsRenderer(null)
  for (const [displayedRegionIndex, data] of rpcDataMap) {
    if (data.numReads === 0) {
      continue
    }
    renderer.uploadRegion(displayedRegionIndex, data)
    if (
      data.connectingLinePositions &&
      data.connectingLineYs &&
      data.numConnectingLines
    ) {
      renderer.uploadConnectingLinesForRegion(displayedRegionIndex, {
        connectingLinePositions: data.connectingLinePositions,
        connectingLineYs: data.connectingLineYs,
        numConnectingLines: data.numConnectingLines,
      })
    }
  }
  for (const [displayedRegionIndex, data] of arcsState.rpcDataMap) {
    renderer.uploadArcsFromTypedArraysForRegion(displayedRegionIndex, {
      arcX1: data.arcX1,
      arcX2: data.arcX2,
      arcColorTypes: data.arcColorTypes,
      arcShapeTypes: data.arcShapeTypes,
      arcYBp: data.arcYBp,
      numArcs: data.numArcs,
      linePositions: data.linePositions,
      lineYs: data.lineYs,
      lineColorTypes: data.lineColorTypes,
      numLines: data.numLines,
    })
  }

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
    drawAlignmentBlocks(ctx, renderer.getRegions(), renderBlocks, state)
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

  const separatorColor = theme.palette.grey[500]

  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={totalWidth}
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
      </SvgClipRect>
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <CoverageYScaleBar model={model} orientation="left" />
        </g>
      ) : null}
      {model.insertSizeTicks ? (
        <g transform={`translate(${totalWidth - 50})`}>
          <YScaleBar ticks={model.insertSizeTicks} orientation="right" />
        </g>
      ) : null}
    </>
  )
}
