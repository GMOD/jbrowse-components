import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { rgb255 } from './colorUtils.ts'
import {
  Canvas2DAlignmentsRenderer,
  drawAlignmentBlocks,
} from './components/Canvas2DAlignmentsRenderer.ts'
import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import YScaleBar from './components/YScaleBar.tsx'
import { sashimiColorPalette } from './components/shaders/palettes.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type Ctx = CanvasRenderingContext2D | SvgCanvas

// Sashimi stays a deliberate SVG-only path: arc counts are low enough that
// vector output performs fine and gives native hover/tooltip behavior, which
// the rasterized/canvas pipeline can't match. Not a porting placeholder.
function drawSashimiArcs(
  ctx: Ctx,
  data: PileupDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  bandHeight: number,
  arcsDown: boolean,
) {
  const pxPerBp = blockWidth / regionLengthBp
  const anchorY = (arcsDown ? 0.1 : 0.9) * bandHeight
  const apexY = (arcsDown ? 0.9 : 0.1) * bandHeight
  // Quadratic bezier with control at cy reaches its peak at (anchor+cy)/2, so
  // cy = 2*apex - anchor makes the rendered peak actually touch apexY.
  const controlY = 2 * apexY - anchorY

  for (let i = 0; i < data.numSashimiArcs; i++) {
    const x1Bp = data.sashimiX1[i]!
    const x2Bp = data.sashimiX2[i]!
    const colorType = data.sashimiColorTypes[i]!
    const lw = data.sashimiScores[i]!

    ctx.strokeStyle =
      colorType < sashimiColorPalette.length
        ? rgb255(sashimiColorPalette[colorType]!)
        : rgb255(sashimiColorPalette[0]!)
    ctx.lineWidth = lw

    const sx1 = blockStartPx + (x1Bp - bpStartOffset) * pxPerBp
    const sx2 = blockStartPx + (x2Bp - bpStartOffset) * pxPerBp
    const midX = (sx1 + sx2) / 2

    ctx.beginPath()
    ctx.moveTo(sx1, anchorY)
    ctx.quadraticCurveTo(midX, controlY, sx2, anchorY)
    ctx.stroke()
  }
}

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
  const blocks = view.dynamicBlocks.contentBlocks
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

  // Sashimi: own SvgCanvas, translated by the band offset in JSX so the local
  // draw uses band-relative Y. Vector by design (see drawSashimiArcs).
  let sashimiNode: React.ReactNode = null
  if (showSashimiArcs && showCoverage) {
    const sashimiCtx = new SvgCanvas()
    const bandHeight = sashimiArcsDown ? sashimiArcsHeight : coverageHeight
    for (const block of blocks) {
      if (block.displayedRegionIndex === undefined) {
        continue
      }
      const data = rpcDataMap.get(block.displayedRegionIndex)
      if (!data || data.numSashimiArcs === 0) {
        continue
      }
      drawSashimiArcs(
        sashimiCtx,
        data,
        block.offsetPx - offsetPx,
        block.start,
        block.end - block.start,
        block.widthPx,
        bandHeight,
        sashimiArcsDown,
      )
    }
    sashimiNode = (
      <g
        transform={`translate(0,${sashimiArcsDown ? coverageHeight : 0})`}
        dangerouslySetInnerHTML={{ __html: sashimiCtx.getSerializedSvg() }}
      />
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
