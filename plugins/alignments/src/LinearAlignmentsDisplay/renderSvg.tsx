import type React from 'react'

import {
  YSCALEBAR_LABEL_OFFSET,
  drawIndicatorTriangle,
} from '@jbrowse/alignments-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import {
  getBaseColorString,
  getBaseColorStringWithAlpha,
  getReadColor,
  makeBasePalette,
  rgb255,
  rgba255,
} from './colorUtils.ts'
import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import { buildColorPaletteFromTheme } from './components/alignmentComponentUtils.ts'
import { INTERBASE_INSERTION, INTERBASE_SOFTCLIP } from '../shared/types.ts'
import {
  ARC_HEIGHT_MARGIN,
  arcColorPalette,
  arcLineColorPalette,
  sashimiColorPalette,
} from './components/shaders/palettes.ts'
import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  insertionBarWidth,
} from './constants.ts'

import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type { ArcsDataResult } from '../shared/computeArcsFromPileupData.ts'
import type { ColorPalette } from './components/shaders/colors.ts'
import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type Ctx = CanvasRenderingContext2D | SvgCanvas

function blendedAlpha(base: number, freq8bit: number) {
  const freq = freq8bit / 255
  return base + freq * (1 - base)
}

function cubicBezierXY(t: number, x1: number, x2: number, destY: number) {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  return {
    xBp: x1 * mt2 * (mt + 3 * t) + x2 * t2 * (3 * mt + t),
    yPx: 3 * mt * t * destY,
  }
}

function evalBezierCurve(
  t: number,
  x1: number,
  x2: number,
  availableHeight: number,
  blockStartPx: number,
  bpStartOffset: number,
  pxPerBp: number,
  isArc: boolean,
) {
  const radius = (x2 - x1) / 2
  const absrad = Math.abs(radius)
  const absradPx = absrad * pxPerBp
  const destY = Math.min(availableHeight, absradPx)

  if (isArc) {
    const angle = t * Math.PI
    const cx = x1 + radius
    const xBp = cx + Math.cos(angle) * radius
    const rawY = Math.sin(angle) * absradPx
    const yPx = absradPx > 0 ? rawY * (destY / absradPx) : 0
    return { x: blockStartPx + (xBp - bpStartOffset) * pxPerBp, y: yPx }
  }

  const { xBp, yPx } = cubicBezierXY(t, x1, x2, destY)
  return { x: blockStartPx + (xBp - bpStartOffset) * pxPerBp, y: yPx }
}

function evalSashimiCurve(
  t: number,
  x1: number,
  x2: number,
  covHeight: number,
  blockStartPx: number,
  bpStartOffset: number,
  pxPerBp: number,
  arcsDown = false,
) {
  const destY = covHeight * (0.8 / 0.75)
  const { xBp, yPx } = cubicBezierXY(t, x1, x2, destY)
  const screenX = blockStartPx + (xBp - bpStartOffset) * pxPerBp
  return {
    x: screenX,
    y: arcsDown ? 0.1 * covHeight + yPx : 0.9 * covHeight - yPx,
  }
}

const ARC_SEGMENTS = 64

function drawPairedArcs(
  ctx: Ctx,
  arcsData: ArcsDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  arcsHeight: number,
  lineWidth: number,
) {
  const pxPerBp = blockWidth / regionLengthBp
  const availableHeight = arcsHeight - ARC_HEIGHT_MARGIN

  for (let i = 0; i < arcsData.numArcs; i++) {
    const x1 = arcsData.arcX1[i]!
    const x2 = arcsData.arcX2[i]!
    const colorType = Math.round(arcsData.arcColorTypes[i]!)
    const isArc = arcsData.arcIsArc[i]! > 0

    ctx.strokeStyle =
      colorType < arcColorPalette.length
        ? rgb255(arcColorPalette[colorType]!)
        : 'grey'
    ctx.lineWidth = lineWidth

    ctx.beginPath()
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      const pt = evalBezierCurve(
        t,
        x1,
        x2,
        availableHeight,
        blockStartPx,
        bpStartOffset,
        pxPerBp,
        isArc,
      )
      if (s === 0) {
        ctx.moveTo(pt.x, pt.y)
      } else {
        ctx.lineTo(pt.x, pt.y)
      }
    }
    ctx.stroke()
  }

  for (let i = 0; i < arcsData.numLines; i++) {
    const xPos = arcsData.linePositions[i * 2]!
    const y0 = arcsData.lineYs[i * 2]!
    const y1 = arcsData.lineYs[i * 2 + 1]!
    const colorType = Math.round(arcsData.lineColorTypes[i * 2]!)

    ctx.strokeStyle =
      colorType < arcLineColorPalette.length
        ? rgb255(arcLineColorPalette[colorType]!)
        : 'grey'
    ctx.lineWidth = 1

    const screenX = blockStartPx + (xPos - bpStartOffset) * pxPerBp
    ctx.beginPath()
    ctx.moveTo(screenX, y0)
    ctx.lineTo(screenX, y1)
    ctx.stroke()
  }
}

function drawSashimiArcs(
  ctx: Ctx,
  data: PileupDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  coverageHeight: number,
  coverageOffset: number,
  arcsDown = false,
) {
  const pxPerBp = blockWidth / regionLengthBp

  for (let i = 0; i < data.numSashimiArcs; i++) {
    const x1 = data.sashimiX1[i]!
    const x2 = data.sashimiX2[i]!
    const colorType = data.sashimiColorTypes[i]!
    const lw = data.sashimiScores[i]!

    ctx.strokeStyle =
      colorType < sashimiColorPalette.length
        ? rgb255(sashimiColorPalette[colorType]!)
        : rgb255(sashimiColorPalette[0]!)
    ctx.lineWidth = lw

    ctx.beginPath()
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      const pt = evalSashimiCurve(
        t,
        x1,
        x2,
        coverageHeight,
        blockStartPx,
        bpStartOffset,
        pxPerBp,
        arcsDown,
      )
      if (s === 0) {
        ctx.moveTo(pt.x, pt.y + coverageOffset)
      } else {
        ctx.lineTo(pt.x, pt.y + coverageOffset)
      }
    }
    ctx.stroke()
  }
}

function drawConnectingLines(
  ctx: Ctx,
  data: PileupDataResult,
  blockStart: number,
  blockEnd: number,
  blockScreenX: number,
  bpPerPx: number,
  pileupTopOffset: number,
  featureHeightSetting: number,
  rowHeight: number,
) {
  const numLines = data.numConnectingLines ?? 0
  const positions = data.connectingLinePositions
  const ys = data.connectingLineYs
  if (!positions || !ys || numLines === 0) {
    return
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1

  for (let i = 0; i < numLines; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!

    if (endBp < blockStart || startBp > blockEnd) {
      continue
    }

    const clippedStart = Math.max(startBp, blockStart)
    const clippedEnd = Math.min(endBp, blockEnd)

    const x1 = (clippedStart - blockStart) / bpPerPx + blockScreenX
    const x2 = (clippedEnd - blockStart) / bpPerPx + blockScreenX
    const rowCenter =
      pileupTopOffset + ys[i]! * rowHeight + featureHeightSetting * 0.5

    ctx.beginPath()
    ctx.moveTo(x1, rowCenter)
    ctx.lineTo(x2, rowCenter)
    ctx.stroke()
  }
}

function drawCoverage(
  ctx: Ctx,
  data: PileupDataResult,
  block: { start: number; end: number },
  blockScreenX: number,
  bpPerPx: number,
  coverageHeight: number,
  offset: number,
  effectiveHeight: number,
  coverageColor: string,
  palette: ColorPalette,
  theme: ReturnType<typeof createJBrowseTheme>,
  showModifications: boolean,
) {
  const {
    coverageDepths,
    coverageMaxDepth,
    coverageStartPos,
    numCoverageBins,
    snpPositions,
    snpYOffsets,
    snpHeights,
    snpColorTypes,
    numSnpSegments,
  } = data

  if (coverageMaxDepth <= 0) {
    return
  }

  const pxPerBp = 1 / bpPerPx

  for (let i = 0; i < numCoverageBins; i++) {
    const depth = coverageDepths[i]
    if (depth === undefined || depth === 0) {
      continue
    }

    const binStart = coverageStartPos + i
    const binEnd = binStart + 1

    if (binEnd < block.start || binStart > block.end) {
      continue
    }

    const x = (binStart - block.start) / bpPerPx + blockScreenX
    const w = Math.max(pxPerBp, 1)
    const barHeight = (depth / coverageMaxDepth) * effectiveHeight
    const y = coverageHeight - offset - barHeight

    ctx.fillStyle = coverageColor
    ctx.fillRect(x, y, w, barHeight)
  }

  if (showModifications && data.numModCovSegments > 0) {
    for (let i = 0; i < data.numModCovSegments; i++) {
      const modStart = data.modCovPositions[i]!
      if (modStart < block.start || modStart > block.end) {
        continue
      }
      const yOff = data.modCovYOffsets[i]!
      const segH = data.modCovHeights[i]!

      const x = (modStart - block.start) / bpPerPx + blockScreenX
      const w = Math.max(pxPerBp, 1)
      const barY = coverageHeight - offset - (yOff + segH) * effectiveHeight
      const barH = segH * effectiveHeight

      ctx.fillStyle = abgrToCssRgba(data.modCovColors[i]!)
      ctx.fillRect(x, barY, w, barH)
    }
  } else {
    const baseNames = ['A', 'C', 'G', 'T']
    for (let i = 0; i < numSnpSegments; i++) {
      const pos = snpPositions[i]
      const yOffset = snpYOffsets[i]
      const segHeight = snpHeights[i]
      const colorType = snpColorTypes[i]

      if (
        pos === undefined ||
        yOffset === undefined ||
        segHeight === undefined ||
        colorType === undefined
      ) {
        continue
      }

      if (pos < block.start || pos > block.end) {
        continue
      }

      const x = (pos - block.start) / bpPerPx + blockScreenX
      const w = Math.max(pxPerBp, 1)
      const barY =
        coverageHeight - offset - (yOffset + segHeight) * effectiveHeight
      const barH = segHeight * effectiveHeight

      const baseName = baseNames[colorType - 1]
      ctx.fillStyle = baseName
        ? theme.palette.bases[baseName as 'A' | 'C' | 'G' | 'T'].main
        : theme.palette.grey[600]

      ctx.fillRect(x, barY, w, barH)
    }
  }
}

function drawInterbaseIndicators(
  ctx: Ctx,
  data: PileupDataResult,
  block: { start: number; end: number },
  blockScreenX: number,
  bpPerPx: number,
  palette: ColorPalette,
) {
  const insertionColor = rgb255(palette.colorInsertion)
  const softclipColor = rgb255(palette.colorSoftclip)
  const hardclipColor = rgb255(palette.colorHardclip)
  const noncovColors = [insertionColor, softclipColor, hardclipColor]

  const noncovHeight = 15
  const indicatorTriangleH = 4.5

  for (let i = 0; i < data.numNoncovSegments; i++) {
    const pos = data.noncovPositions[i]!
    if (pos < block.start || pos > block.end) {
      continue
    }
    const cx = (pos - block.start) / bpPerPx + blockScreenX
    const yOff = data.noncovYOffsets[i]!
    const segH = data.noncovHeights[i]!
    const colorType = data.noncovColorTypes[i]!
    const color = noncovColors[colorType - 1] ?? noncovColors[0]!
    const segTopPx = indicatorTriangleH + yOff * noncovHeight
    const segHeightPx = segH * noncovHeight

    ctx.fillStyle = color
    ctx.fillRect(cx - 0.5, segTopPx, 1, segHeightPx)
  }

  for (let i = 0; i < data.numIndicators; i++) {
    const pos = data.indicatorPositions[i]!
    if (pos < block.start || pos > block.end) {
      continue
    }
    const cx = (pos - block.start) / bpPerPx + blockScreenX
    const colorType = data.indicatorColorTypes[i]!
    ctx.fillStyle = noncovColors[colorType - 1] ?? noncovColors[0]!
    drawIndicatorTriangle(ctx, cx)
  }
}

function drawPileup(
  ctx: Ctx,
  data: PileupDataResult,
  block: { start: number; end: number },
  blockScreenX: number,
  bpPerPx: number,
  yOffset: number,
  featureHeightSetting: number,
  rowHeight: number,
  colorSchemeIndex: number,
  palette: ColorPalette,
  renderingMode: string,
  showMismatches: boolean,
  showModifications: boolean,
  showSoftClipping: boolean,
) {
  const { numReads, readPositions, readYs } = data
  const basePal = makeBasePalette(palette)
  const pxPerBp = 1 / bpPerPx

  for (let i = 0; i < numReads; i++) {
    const startBp = readPositions[i * 2]!
    const endBp = readPositions[i * 2 + 1]!
    if (endBp < block.start || startBp > block.end) {
      continue
    }
    const clippedStart = Math.max(startBp, block.start)
    const clippedEnd = Math.min(endBp, block.end)
    const x = (clippedStart - block.start) / bpPerPx + blockScreenX
    const x2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
    const w = Math.max(x2 - x, 0.5)
    const y = yOffset + readYs[i]! * rowHeight
    ctx.fillStyle = getReadColor(i, data, colorSchemeIndex, palette, {
      renderingMode,
    })
    ctx.fillRect(x, y, w, featureHeightSetting)
  }

  if (showMismatches) {
    const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } = data

    for (let i = 0; i < numMismatches; i++) {
      const pos = mismatchPositions[i]!
      if (pos < block.start || pos > block.end) {
        continue
      }
      const x = (pos - block.start) / bpPerPx + blockScreenX
      const w = Math.max(pxPerBp, 1)
      const y = yOffset + mismatchYs[i]! * rowHeight
      const mismatchAlpha =
        pxPerBp < 1 ? blendedAlpha(pxPerBp, data.mismatchFrequencies[i]!) : 1
      if (mismatchAlpha > 0) {
        const base = String.fromCharCode(mismatchBases[i]!)
        ctx.fillStyle = getBaseColorStringWithAlpha(
          base,
          basePal,
          palette,
          mismatchAlpha,
        )
        ctx.fillRect(x, y, w, featureHeightSetting)
      }
    }

    const skipColor = rgb255(palette.colorSkip)

    for (let i = 0; i < data.numGaps; i++) {
      const startBp = data.gapPositions[i * 2]!
      const endBp = data.gapPositions[i * 2 + 1]!
      if (endBp < block.start || startBp > block.end) {
        continue
      }
      const gapType = data.gapTypes[i]!
      const clippedStart = Math.max(startBp, block.start)
      const clippedEnd = Math.min(endBp, block.end)
      const gx = (clippedStart - block.start) / bpPerPx + blockScreenX
      const gx2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
      const gw = gx2 - gx
      const gy = yOffset + data.gapYs[i]! * rowHeight

      if (gapType === 0) {
        const widthPx = (endBp - startBp) * pxPerBp
        const alpha =
          widthPx < 1
            ? blendedAlpha(widthPx * widthPx, data.gapFrequencies[i]!)
            : 1
        if (alpha > 0) {
          ctx.fillStyle = rgba255(palette.colorDeletion, alpha)
          ctx.fillRect(gx, gy, gw, featureHeightSetting)
        }
      } else {
        const midY = gy + featureHeightSetting * 0.5
        ctx.strokeStyle = skipColor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(gx, midY)
        ctx.lineTo(gx + gw, midY)
        ctx.stroke()
      }
    }

    for (let i = 0; i < data.numInterbases; i++) {
      const pos = data.interbasePositions[i]!
      if (pos < block.start || pos > block.end) {
        continue
      }
      const ibType = data.interbaseTypes[i]!
      const ibY = yOffset + data.interbaseYs[i]! * rowHeight
      const cx = (pos - block.start) / bpPerPx + blockScreenX

      if (ibType === INTERBASE_INSERTION) {
        const len = data.interbaseLengths[i]!
        const isLong = len >= LONG_INSERTION_MIN_LENGTH
        const barW = insertionBarWidth(len, pxPerBp)
        const isLarge = barW > 5
        const insertionAlpha =
          !isLong && pxPerBp < 1
            ? blendedAlpha(pxPerBp * pxPerBp, data.interbaseFrequencies[i]!)
            : 1
        if (insertionAlpha > 0) {
          ctx.fillStyle = rgba255(palette.colorInsertion, insertionAlpha)
          ctx.fillRect(cx - barW / 2, ibY, barW, featureHeightSetting)
          if (!isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP) {
            ctx.fillRect(cx - 1.5, ibY, 3, 1)
            ctx.fillRect(cx - 1.5, ibY + featureHeightSetting - 1, 3, 1)
          }
          if (isLarge) {
            ctx.fillStyle = `rgba(255,255,255,${insertionAlpha})`
            ctx.font = '9px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(`${len}`, cx, ibY + featureHeightSetting / 2)
          }
        }
      } else {
        const barWidthBp = Math.max(bpPerPx, Math.min(2 * bpPerPx, 1))
        const bw = Math.max(barWidthBp / bpPerPx, 1)
        const clipAlpha =
          pxPerBp < 1 ? blendedAlpha(pxPerBp, data.interbaseFrequencies[i]!) : 1
        if (clipAlpha > 0) {
          const clipColor =
            ibType === INTERBASE_SOFTCLIP
              ? palette.colorSoftclip
              : palette.colorHardclip
          ctx.fillStyle = rgba255(clipColor, clipAlpha)
          ctx.fillRect(cx - bw / 2, ibY, bw, featureHeightSetting)
        }
      }
    }

    if (showModifications && data.numModifications > 0) {
      for (let i = 0; i < data.numModifications; i++) {
        const pos = data.modificationPositions[i]!
        if (pos < block.start || pos > block.end) {
          continue
        }
        const mx = (pos - block.start) / bpPerPx + blockScreenX
        const mw = Math.max(pxPerBp, 0.5)
        const my = yOffset + data.modificationYs[i]! * rowHeight
        ctx.fillStyle = abgrToCssRgba(data.modificationColors[i]!)
        ctx.fillRect(mx, my, mw, featureHeightSetting)
      }
    }
  }

  if (showSoftClipping && data.numSoftclipBases > 0) {
    for (let i = 0; i < data.numSoftclipBases; i++) {
      const pos = data.softclipBasePositions[i]!
      if (pos < block.start || pos > block.end) {
        continue
      }
      const base = String.fromCharCode(data.softclipBaseBases[i]!)
      const x = (pos - block.start) / bpPerPx + blockScreenX
      const w = Math.max(pxPerBp, 0.5)
      const y = yOffset + data.softclipBaseYs[i]! * rowHeight
      ctx.fillStyle = getBaseColorString(base, basePal, palette)
      ctx.fillRect(x, y, w, featureHeightSetting)
    }
  }
}

function createCtx(
  rasterize: boolean | undefined,
  width: number,
  height: number,
  opts?: ExportSvgDisplayOptions,
) {
  if (rasterize && width > 0 && height > 0) {
    const canvas =
      opts?.createCanvas?.(width * 2, height * 2) ??
      document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx?.scale(2, 2)
    return { canvas, ctx: ctx ?? undefined }
  }
  const svgCtx = new SvgCanvas()
  return { canvas: undefined, ctx: svgCtx as Ctx }
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
  const { offsetPx, bpPerPx } = view
  const {
    laidOutPileupMap: rpcDataMap,
    showCoverage,
    coverageHeight,
    coverageTicks,
    featureHeightSetting,
    featureSpacing,
    colorSchemeIndex,
    showArcs,
    arcsHeight,
    pairedArcsDown,
    arcsState,
    showSashimiArcs,
    sashimiArcsDown,
    sashimiArcsHeight,
    showLinkedReads,
    showInterbaseIndicators,
    showSoftClipping,
    coverageDisplayHeight: pileupTopOffset,
  } = model

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  if (rpcDataMap.size === 0) {
    return null
  }

  const palette = model.colorPalette ?? buildColorPaletteFromTheme(theme)
  const blocks = view.dynamicBlocks.contentBlocks
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveHeight = coverageHeight - offset * 2
  const rowHeight = featureHeightSetting + featureSpacing
  const arcLineWidth = arcsState.lineWidth
  const rasterize = opts?.rasterizeLayers
  const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const pileupHeight = Math.max(0, model.height - pileupTopOffset)
  const displayHeight = model.height
  const renderingMode = showLinkedReads ? 'linkedRead' : 'pileup'

  const coverageColor = theme.palette.coverage

  // Create contexts — either real canvas (rasterize) or SvgCanvas (vector)
  const pileup = createCtx(rasterize, totalWidth, pileupHeight, opts)
  const arcsCtxHeight = pairedArcsDown ? arcsHeight : coverageHeight
  const arcsCtxObj = showArcs
    ? createCtx(rasterize, totalWidth, arcsCtxHeight, opts)
    : undefined

  // Coverage + indicators always use SvgCanvas (lightweight, no rasterize needed)
  const covCtx = new SvgCanvas()
  const indicatorCtx = new SvgCanvas()
  const sashimiCtx =
    showSashimiArcs && sashimiArcsDown && showCoverage
      ? new SvgCanvas()
      : undefined

  for (const block of blocks) {
    if (block.displayedRegionIndex === undefined) {
      continue
    }
    const data = rpcDataMap.get(block.displayedRegionIndex)
    if (!data) {
      continue
    }

    const blockScreenX = block.offsetPx - offsetPx
    const blockWidth = block.widthPx
    const regionLengthBp = block.end - block.start

    if (showCoverage) {
      drawCoverage(
        covCtx,
        data,
        block,
        blockScreenX,
        bpPerPx,
        coverageHeight,
        offset,
        effectiveHeight,
        coverageColor,
        palette,
        theme,
        model.showModifications,
      )

      if (showSashimiArcs && data.numSashimiArcs > 0) {
        if (sashimiArcsDown && sashimiCtx) {
          drawSashimiArcs(
            sashimiCtx,
            data,
            blockScreenX,
            block.start,
            regionLengthBp,
            blockWidth,
            sashimiArcsHeight,
            0,
            true,
          )
        } else {
          drawSashimiArcs(
            covCtx,
            data,
            blockScreenX,
            block.start,
            regionLengthBp,
            blockWidth,
            coverageHeight,
            0,
            false,
          )
        }
      }
    }

    if (showArcs && arcsCtxObj?.ctx) {
      const arcsData = arcsState.rpcDataMap.get(block.displayedRegionIndex)
      if (arcsData && arcsData.numArcs > 0) {
        drawPairedArcs(
          arcsCtxObj.ctx,
          arcsData,
          blockScreenX,
          block.start,
          regionLengthBp,
          blockWidth,
          arcsCtxHeight,
          arcLineWidth,
        )
      }
    }

    if (showLinkedReads && pileup.ctx) {
      drawConnectingLines(
        pileup.ctx,
        data,
        block.start,
        block.end,
        blockScreenX,
        bpPerPx,
        rasterize ? 0 : pileupTopOffset,
        featureHeightSetting,
        rowHeight,
      )
    }

    if (pileup.ctx) {
      drawPileup(
        pileup.ctx,
        data,
        block,
        blockScreenX,
        bpPerPx,
        rasterize ? 0 : pileupTopOffset,
        featureHeightSetting,
        rowHeight,
        colorSchemeIndex,
        palette,
        renderingMode,
        model.showMismatches,
        model.showModifications,
        showSoftClipping,
      )
    }

    if (showCoverage && showInterbaseIndicators) {
      drawInterbaseIndicators(
        indicatorCtx,
        data,
        block,
        blockScreenX,
        bpPerPx,
        palette,
      )
    }
  }

  const separatorColor = theme.palette.grey[500]

  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={totalWidth}
        height={displayHeight}
      >
        {showCoverage ? (
          <g dangerouslySetInnerHTML={{ __html: covCtx.getSerializedSvg() }} />
        ) : null}
        {showCoverage ? (
          <>
            <g
              dangerouslySetInnerHTML={{
                __html: indicatorCtx.getSerializedSvg(),
              }}
            />
            <line
              x1={0}
              y1={coverageHeight}
              x2={totalWidth}
              y2={coverageHeight}
              stroke={separatorColor}
              strokeWidth={1}
            />
          </>
        ) : null}
        {sashimiCtx ? (
          <g
            transform={`translate(0,${showCoverage ? coverageHeight : 0})`}
            dangerouslySetInnerHTML={{ __html: sashimiCtx.getSerializedSvg() }}
          />
        ) : null}
        {arcsCtxObj ? (
          arcsCtxObj.canvas ? (
            <image
              x={0}
              y={pairedArcsDown && showCoverage ? coverageHeight : 0}
              width={totalWidth}
              height={arcsCtxHeight}
              xlinkHref={arcsCtxObj.canvas.toDataURL('image/png')}
            />
          ) : (
            <g
              transform={`translate(0,${pairedArcsDown && showCoverage ? coverageHeight : 0})`}
              dangerouslySetInnerHTML={{
                __html: (arcsCtxObj.ctx as SvgCanvas).getSerializedSvg(),
              }}
            />
          )
        ) : null}
        {pileup.canvas ? (
          <image
            x={0}
            y={pileupTopOffset}
            width={totalWidth}
            height={pileupHeight}
            xlinkHref={pileup.canvas.toDataURL('image/png')}
          />
        ) : (
          <g
            dangerouslySetInnerHTML={{
              __html: (pileup.ctx as SvgCanvas).getSerializedSvg(),
            }}
          />
        )}
      </SvgClipRect>
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <CoverageYScaleBar model={model} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
