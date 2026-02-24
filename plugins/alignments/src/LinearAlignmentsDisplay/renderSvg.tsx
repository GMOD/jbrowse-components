import type React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import { buildColorPaletteFromTheme } from './components/alignmentComponentUtils.ts'
import {
  arcColorPalette,
  arcLineColorPalette,
  sashimiColorPalette,
} from './components/shaders/arcShaders.ts'
import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  INSERTION_TEXT_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from './constants.ts'
import { ColorScheme, YSCALEBAR_LABEL_OFFSET } from './model.ts'

import type { ArcsDataResult } from '../RenderArcsDataRPC/types.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type { ColorPalette, RGBColor } from './components/shaders/colors.ts'
import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function rgb255(c: RGBColor) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
}

function hslToRgbString(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (h / 360) * 6
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2
  let r: number
  let g: number
  let b: number
  if (hp < 1) {
    ;[r, g, b] = [c, x, 0]
  } else if (hp < 2) {
    ;[r, g, b] = [x, c, 0]
  } else if (hp < 3) {
    ;[r, g, b] = [0, c, x]
  } else if (hp < 4) {
    ;[r, g, b] = [0, x, c]
  } else if (hp < 5) {
    ;[r, g, b] = [x, 0, c]
  } else {
    ;[r, g, b] = [c, 0, x]
  }
  return `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)})`
}

function getReadColor(
  i: number,
  data: PileupDataResult,
  colorScheme: number,
  palette: ColorPalette,
  insertSizeStats?: { upper: number; lower: number },
) {
  const strand = data.readStrands[i]!
  const flags = data.readFlags[i]!
  const mapq = data.readMapqs[i]!
  const insertSize = data.readInsertSizes[i]!
  const pairOrientation = data.readPairOrientations[i]!

  switch (colorScheme) {
    case ColorScheme.strand:
      if (strand > 0) {
        return rgb255(palette.colorFwdStrand)
      }
      if (strand < 0) {
        return rgb255(palette.colorRevStrand)
      }
      return rgb255(palette.colorNostrand)

    case ColorScheme.mappingQuality:
      return hslToRgbString(mapq, 0.5, 0.5)

    case ColorScheme.insertSize:
      if (insertSizeStats) {
        if (insertSize > insertSizeStats.upper) {
          return rgb255(palette.colorLongInsert)
        }
        if (insertSize < insertSizeStats.lower) {
          return rgb255(palette.colorShortInsert)
        }
      }
      return rgb255(palette.colorPairLR)

    case ColorScheme.firstOfPairStrand: {
      const isFirst = (flags & 64) !== 0
      const effectiveStrand = isFirst ? strand : -strand
      if (effectiveStrand > 0) {
        return rgb255(palette.colorFwdStrand)
      }
      if (effectiveStrand < 0) {
        return rgb255(palette.colorRevStrand)
      }
      return rgb255(palette.colorNostrand)
    }

    case ColorScheme.pairOrientation:
      if (pairOrientation === 1) {
        return rgb255(palette.colorPairLR)
      }
      if (pairOrientation === 2) {
        return rgb255(palette.colorPairRL)
      }
      if (pairOrientation === 3) {
        return rgb255(palette.colorPairRR)
      }
      if (pairOrientation === 4) {
        return rgb255(palette.colorPairLL)
      }
      return rgb255(palette.colorNostrand)

    case ColorScheme.insertSizeAndOrientation:
      if (pairOrientation === 2) {
        return rgb255(palette.colorPairRL)
      }
      if (pairOrientation === 3) {
        return rgb255(palette.colorPairRR)
      }
      if (pairOrientation === 4) {
        return rgb255(palette.colorPairLL)
      }
      if (insertSizeStats) {
        if (insertSize > insertSizeStats.upper) {
          return rgb255(palette.colorLongInsert)
        }
        if (insertSize < insertSizeStats.lower) {
          return rgb255(palette.colorShortInsert)
        }
      }
      return rgb255(palette.colorPairLR)

    case ColorScheme.modifications: {
      const isReverse = (flags & 16) !== 0
      return rgb255(
        isReverse ? palette.colorModificationRev : palette.colorModificationFwd,
      )
    }

    case ColorScheme.tag:
      if (data.numTagColors > 0 && i < data.numTagColors) {
        const r = data.readTagColors[i * 3]!
        const g = data.readTagColors[i * 3 + 1]!
        const b = data.readTagColors[i * 3 + 2]!
        return `rgb(${r},${g},${b})`
      }
      return rgb255(palette.colorPairLR)

    default:
      return rgb255(palette.colorPairLR)
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

  let xBp: number
  let yPx: number

  if (isArc) {
    const angle = t * Math.PI
    const cx = x1 + radius
    xBp = cx + Math.cos(angle) * radius
    const rawY = Math.sin(angle) * absradPx
    yPx = absradPx > 0 ? rawY * (destY / absradPx) : 0
  } else {
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    xBp = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2
    yPx = 3 * mt2 * t * destY + 3 * mt * t2 * destY
  }

  const screenX = blockStartPx + (xBp - bpStartOffset) * pxPerBp
  return { x: screenX, y: yPx }
}

function evalSashimiCurve(
  t: number,
  x1: number,
  x2: number,
  covHeight: number,
  blockStartPx: number,
  bpStartOffset: number,
  pxPerBp: number,
) {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  const xBp = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2
  const destY = covHeight * (0.8 / 0.75)
  const yPx = 3 * mt2 * t * destY + 3 * mt * t2 * destY
  const screenX = blockStartPx + (xBp - bpStartOffset) * pxPerBp
  return { x: screenX, y: 0.9 * covHeight - yPx }
}

function buildCurvePath(
  points: { x: number; y: number }[],
  coverageOffset: number,
) {
  if (points.length === 0) {
    return ''
  }
  let d = `M${points[0]!.x},${points[0]!.y + coverageOffset}`
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i]!.x},${points[i]!.y + coverageOffset}`
  }
  return d
}

const ARC_SEGMENTS = 64

function renderPairedArcsSvg(
  arcsData: ArcsDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  coverageOffset: number,
  arcsHeight: number,
  lineWidth: number,
) {
  let content = ''
  const pxPerBp = blockWidth / regionLengthBp
  const availableHeight = arcsHeight

  for (let i = 0; i < arcsData.numArcs; i++) {
    const x1 = arcsData.arcX1[i]!
    const x2 = arcsData.arcX2[i]!
    const colorType = Math.round(arcsData.arcColorTypes[i]!)
    const isArc = arcsData.arcIsArc[i]! > 0

    const color =
      colorType < arcColorPalette.length
        ? rgb255(arcColorPalette[colorType]!)
        : 'grey'

    const points: { x: number; y: number }[] = []
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      points.push(
        evalBezierCurve(
          t,
          x1,
          x2,
          availableHeight,
          blockStartPx,
          bpStartOffset,
          pxPerBp,
          isArc,
        ),
      )
    }

    const d = buildCurvePath(points, coverageOffset)
    content += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${lineWidth}"/>`
  }

  for (let i = 0; i < arcsData.numLines; i++) {
    const xPos = arcsData.regionStart + arcsData.linePositions[i * 2]!
    const y0 = arcsData.lineYs[i * 2]! + coverageOffset
    const y1 = arcsData.lineYs[i * 2 + 1]! + coverageOffset
    const colorType = Math.round(arcsData.lineColorTypes[i * 2]!)
    const color =
      colorType < arcLineColorPalette.length
        ? rgb255(arcLineColorPalette[colorType]!)
        : 'grey'

    const screenX =
      blockStartPx + (xPos - arcsData.regionStart - bpStartOffset) * pxPerBp
    content += `<line x1="${screenX}" y1="${y0}" x2="${screenX}" y2="${y1}" stroke="${color}" stroke-width="1"/>`
  }

  return content
}

function renderPairedArcsCanvas(
  ctx: CanvasRenderingContext2D,
  arcsData: ArcsDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  arcsHeight: number,
  lineWidth: number,
) {
  const pxPerBp = blockWidth / regionLengthBp
  const availableHeight = arcsHeight

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

    const points: { x: number; y: number }[] = []
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      points.push(
        evalBezierCurve(
          t,
          x1,
          x2,
          availableHeight,
          blockStartPx,
          bpStartOffset,
          pxPerBp,
          isArc,
        ),
      )
    }

    ctx.beginPath()
    ctx.moveTo(points[0]!.x, points[0]!.y)
    for (let j = 1; j < points.length; j++) {
      ctx.lineTo(points[j]!.x, points[j]!.y)
    }
    ctx.stroke()
  }

  for (let i = 0; i < arcsData.numLines; i++) {
    const xPos = arcsData.regionStart + arcsData.linePositions[i * 2]!
    const y0 = arcsData.lineYs[i * 2]!
    const y1 = arcsData.lineYs[i * 2 + 1]!
    const colorType = Math.round(arcsData.lineColorTypes[i * 2]!)

    ctx.strokeStyle =
      colorType < arcLineColorPalette.length
        ? rgb255(arcLineColorPalette[colorType]!)
        : 'grey'
    ctx.lineWidth = 1

    const screenX =
      blockStartPx + (xPos - arcsData.regionStart - bpStartOffset) * pxPerBp
    ctx.beginPath()
    ctx.moveTo(screenX, y0)
    ctx.lineTo(screenX, y1)
    ctx.stroke()
  }
}

function renderSashimiArcs(
  data: PileupDataResult,
  blockStartPx: number,
  bpStartOffset: number,
  regionLengthBp: number,
  blockWidth: number,
  coverageHeight: number,
  coverageOffset: number,
) {
  let content = ''
  const pxPerBp = blockWidth / regionLengthBp

  for (let i = 0; i < data.numSashimiArcs; i++) {
    const x1 = data.sashimiX1[i]!
    const x2 = data.sashimiX2[i]!
    const colorType = data.sashimiColorTypes[i]!
    const lineWidth = data.sashimiScores[i]!

    const color =
      colorType < sashimiColorPalette.length
        ? rgb255(sashimiColorPalette[colorType]!)
        : rgb255(sashimiColorPalette[0]!)

    const points: { x: number; y: number }[] = []
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      points.push(
        evalSashimiCurve(
          t,
          x1,
          x2,
          coverageHeight,
          blockStartPx,
          bpStartOffset,
          pxPerBp,
        ),
      )
    }

    const d = buildCurvePath(points, coverageOffset)
    content += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${lineWidth}"/>`
  }

  return content
}

function renderConnectingLines(
  data: PileupDataResult,
  blockStart: number,
  blockEnd: number,
  blockScreenX: number,
  bpPerPx: number,
  pileupTopOffset: number,
  featureHeightSetting: number,
  rowHeight: number,
) {
  let content = ''
  const numLines = data.numConnectingLines ?? 0
  const positions = data.connectingLinePositions
  const ys = data.connectingLineYs
  if (!positions || !ys || numLines === 0) {
    return content
  }

  const regionStart = data.regionStart

  for (let i = 0; i < numLines; i++) {
    const startBp = regionStart + positions[i * 2]!
    const endBp = regionStart + positions[i * 2 + 1]!

    if (endBp < blockStart || startBp > blockEnd) {
      continue
    }

    const clippedStart = Math.max(startBp, blockStart)
    const clippedEnd = Math.min(endBp, blockEnd)

    const x1 = (clippedStart - blockStart) / bpPerPx + blockScreenX
    const x2 = (clippedEnd - blockStart) / bpPerPx + blockScreenX
    const rowCenter =
      pileupTopOffset + ys[i]! * rowHeight + featureHeightSetting * 0.5

    content += `<line x1="${x1}" y1="${rowCenter}" x2="${x2}" y2="${rowCenter}" stroke="rgb(0,0,0)" stroke-opacity="0.45" stroke-width="1"/>`
  }
  return content
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
    rpcDataMap,
    showCoverage,
    coverageHeight,
    coverageTicks,
    featureHeightSetting,
    featureSpacing,
    colorSchemeIndex,
    showArcs,
    arcsHeight,
    arcsState,
    showSashimiArcs,
    showLinkedReads,
    showInterbaseIndicators,
  } = model

  if (rpcDataMap.size === 0) {
    return null
  }

  const palette = model.colorPalette ?? buildColorPaletteFromTheme(theme)
  const blocks = view.dynamicBlocks.contentBlocks
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveHeight = coverageHeight - offset * 2
  const pileupTopOffset =
    (showCoverage ? coverageHeight : 0) + (showArcs ? arcsHeight : 0)
  const rowHeight = featureHeightSetting + featureSpacing
  const arcLineWidth = arcsState.lineWidth

  let content = ''
  const rasterize = opts?.rasterizeLayers
  const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const pileupHeight = Math.max(0, model.height - pileupTopOffset)

  let pileupCanvas: HTMLCanvasElement | undefined
  let pileupCtx: CanvasRenderingContext2D | undefined
  if (rasterize && pileupHeight > 0 && totalWidth > 0) {
    pileupCanvas =
      opts.createCanvas?.(totalWidth * 2, pileupHeight * 2) ??
      document.createElement('canvas')
    pileupCanvas.width = totalWidth * 2
    pileupCanvas.height = pileupHeight * 2
    pileupCtx = pileupCanvas.getContext('2d') ?? undefined
    pileupCtx?.scale(2, 2)
  }

  let arcsCanvas: HTMLCanvasElement | undefined
  let arcsCtx: CanvasRenderingContext2D | undefined
  if (rasterize && showArcs && arcsHeight > 0 && totalWidth > 0) {
    arcsCanvas =
      opts.createCanvas?.(totalWidth * 2, arcsHeight * 2) ??
      document.createElement('canvas')
    arcsCanvas.width = totalWidth * 2
    arcsCanvas.height = arcsHeight * 2
    arcsCtx = arcsCanvas.getContext('2d') ?? undefined
    arcsCtx?.scale(2, 2)
  }

  for (const block of blocks) {
    if (block.regionNumber === undefined) {
      continue
    }
    const data = rpcDataMap.get(block.regionNumber)
    if (!data) {
      continue
    }

    const blockScreenX = block.offsetPx - offsetPx
    const blockWidth = block.widthPx
    const regionLengthBp = block.end - block.start

    if (showCoverage) {
      const {
        coverageDepths,
        coverageMaxDepth,
        coverageStartOffset,
        numCoverageBins,
        regionStart,
        snpPositions,
        snpYOffsets,
        snpHeights,
        snpColorTypes,
        numSnpSegments,
      } = data

      if (coverageMaxDepth > 0) {
        const nicedMax = coverageTicks?.nicedMax ?? coverageMaxDepth

        const coverageColor =
          theme.palette.mode === 'dark'
            ? theme.palette.grey[700]
            : theme.palette.grey[400]

        for (let i = 0; i < numCoverageBins; i++) {
          const depth = coverageDepths[i]
          if (depth === undefined || depth === 0) {
            continue
          }

          const binStart = regionStart + coverageStartOffset + i
          const binEnd = binStart + 1

          if (binEnd < block.start || binStart > block.end) {
            continue
          }

          const x = (binStart - block.start) / bpPerPx + blockScreenX
          const w = Math.max(1 / bpPerPx, 1)
          const normalizedDepth = depth / nicedMax
          const barHeight = normalizedDepth * effectiveHeight
          const y = coverageHeight - offset - barHeight

          content += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="${coverageColor}"/>`
        }

        const depthScale = coverageMaxDepth / nicedMax

        if (model.showModifications && data.numModCovSegments > 0) {
          for (let i = 0; i < data.numModCovSegments; i++) {
            const pos = data.modCovPositions[i]!
            const modStart = regionStart + pos
            if (modStart < block.start || modStart > block.end) {
              continue
            }
            const yOff = data.modCovYOffsets[i]!
            const segH = data.modCovHeights[i]!
            const r = data.modCovColors[i * 4]!
            const g = data.modCovColors[i * 4 + 1]!
            const b = data.modCovColors[i * 4 + 2]!
            const a = data.modCovColors[i * 4 + 3]! / 255

            const x = (modStart - block.start) / bpPerPx + blockScreenX
            const w = Math.max(1 / bpPerPx, 1)
            const barY =
              coverageHeight -
              offset -
              (yOff + segH) * depthScale * effectiveHeight
            const barH = segH * depthScale * effectiveHeight

            content += `<rect x="${x}" y="${barY}" width="${w}" height="${barH}" fill="rgb(${r},${g},${b})" fill-opacity="${a}"/>`
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

            const snpStart = regionStart + pos
            if (snpStart < block.start || snpStart > block.end) {
              continue
            }

            const x = (snpStart - block.start) / bpPerPx + blockScreenX
            const w = Math.max(1 / bpPerPx, 1)
            const barY =
              coverageHeight -
              offset -
              (yOffset + segHeight) * depthScale * effectiveHeight
            const barH = segHeight * depthScale * effectiveHeight

            const baseName = baseNames[colorType - 1]
            const fillColor = baseName
              ? theme.palette.bases[baseName as 'A' | 'C' | 'G' | 'T'].main
              : theme.palette.grey[600]

            content += `<rect x="${x}" y="${barY}" width="${w}" height="${barH}" fill="${fillColor}"/>`
          }
        }
      }

      if (showSashimiArcs && data.numSashimiArcs > 0) {
        content += renderSashimiArcs(
          data,
          blockScreenX,
          block.start - data.regionStart,
          regionLengthBp,
          blockWidth,
          coverageHeight,
          0,
        )
      }
    }

    if (showArcs) {
      const arcsData = arcsState.rpcDataMap.get(block.regionNumber)
      if (arcsData && arcsData.numArcs > 0) {
        if (arcsCtx) {
          renderPairedArcsCanvas(
            arcsCtx,
            arcsData,
            blockScreenX,
            block.start - arcsData.regionStart,
            regionLengthBp,
            blockWidth,
            arcsHeight,
            arcLineWidth,
          )
        } else {
          const coverageOffset = showCoverage ? coverageHeight : 0
          content += renderPairedArcsSvg(
            arcsData,
            blockScreenX,
            block.start - arcsData.regionStart,
            regionLengthBp,
            blockWidth,
            coverageOffset,
            arcsHeight,
            arcLineWidth,
          )
        }
      }
    }

    if (showLinkedReads) {
      content += renderConnectingLines(
        data,
        block.start,
        block.end,
        blockScreenX,
        bpPerPx,
        pileupTopOffset,
        featureHeightSetting,
        rowHeight,
      )
    }

    const { regionStart, numReads, readPositions, readYs } = data

    if (pileupCtx) {
      for (let i = 0; i < numReads; i++) {
        const startBp = regionStart + readPositions[i * 2]!
        const endBp = regionStart + readPositions[i * 2 + 1]!
        if (endBp < block.start || startBp > block.end) {
          continue
        }
        const clippedStart = Math.max(startBp, block.start)
        const clippedEnd = Math.min(endBp, block.end)
        const x = (clippedStart - block.start) / bpPerPx + blockScreenX
        const x2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
        const w = Math.max(x2 - x, 0.5)
        const y = readYs[i]! * rowHeight
        pileupCtx.fillStyle = getReadColor(
          i,
          data,
          colorSchemeIndex,
          palette,
          data.insertSizeStats,
        )
        pileupCtx.fillRect(x, y, w, featureHeightSetting)
      }

      if (model.showMismatches) {
        const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } =
          data
        for (let i = 0; i < numMismatches; i++) {
          const pos = regionStart + mismatchPositions[i]!
          if (pos < block.start || pos > block.end) {
            continue
          }
          const x = (pos - block.start) / bpPerPx + blockScreenX
          const w = Math.max(1 / bpPerPx, 0.5)
          const y = mismatchYs[i]! * rowHeight
          const base = String.fromCharCode(mismatchBases[i]!)
          const basePalette: Record<string, RGBColor> = {
            A: palette.colorBaseA,
            C: palette.colorBaseC,
            G: palette.colorBaseG,
            T: palette.colorBaseT,
          }
          pileupCtx.fillStyle = basePalette[base]
            ? rgb255(basePalette[base])
            : rgb255(palette.colorNostrand)
          pileupCtx.fillRect(x, y, w, featureHeightSetting)
        }

        const pxPerBp = 1 / bpPerPx
        const deletionColor = rgb255(palette.colorDeletion)
        const skipColor = rgb255(palette.colorSkip)
        for (let i = 0; i < data.numGaps; i++) {
          const startBp = regionStart + data.gapPositions[i * 2]!
          const endBp = regionStart + data.gapPositions[i * 2 + 1]!
          if (endBp < block.start || startBp > block.end) {
            continue
          }
          const gapType = data.gapTypes[i]!
          const clippedStart = Math.max(startBp, block.start)
          const clippedEnd = Math.min(endBp, block.end)
          const gx = (clippedStart - block.start) / bpPerPx + blockScreenX
          const gx2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
          const gw = Math.max(gx2 - gx, 0.5)
          const gy = data.gapYs[i]! * rowHeight

          if (gapType === 0) {
            const widthPx = (endBp - startBp) * pxPerBp
            const alpha = widthPx < 1 && data.gapFrequencies[i] === 0 ? widthPx * widthPx : 1
            if (alpha > 0) {
              pileupCtx.globalAlpha = alpha
              pileupCtx.fillStyle = deletionColor
              pileupCtx.fillRect(gx, gy, gw, featureHeightSetting)
              pileupCtx.globalAlpha = 1
            }
          } else {
            const midY = gy + featureHeightSetting * 0.5
            pileupCtx.strokeStyle = skipColor
            pileupCtx.lineWidth = 1
            pileupCtx.beginPath()
            pileupCtx.moveTo(gx, midY)
            pileupCtx.lineTo(gx + gw, midY)
            pileupCtx.stroke()
          }
        }

        const insertionColor = rgb255(palette.colorInsertion)
        const softclipColor = rgb255(palette.colorSoftclip)
        const hardclipColor = rgb255(palette.colorHardclip)
        for (let i = 0; i < data.numInterbases; i++) {
          const pos = regionStart + data.interbasePositions[i]!
          if (pos < block.start || pos > block.end) {
            continue
          }
          const ibType = data.interbaseTypes[i]!
          const ibY = data.interbaseYs[i]! * rowHeight
          const cx = (pos - block.start) / bpPerPx + blockScreenX

          if (ibType === 1) {
            pileupCtx.fillStyle = insertionColor
            const len = data.interbaseLengths[i]!
            const isLong = len >= LONG_INSERTION_MIN_LENGTH
            const insertionWidthPx = len * pxPerBp
            const canShowText = insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX && pxPerBp >= INSERTION_TEXT_MIN_PX_PER_BP
            const isLarge = isLong && canShowText
            let barW: number
            if (isLarge) {
              const digits = len < 10 ? 1 : len < 100 ? 2 : len < 1000 ? 3 : len < 10000 ? 4 : 5
              barW = digits * 6 + 10
            } else if (isLong) {
              barW = Math.min(5, insertionWidthPx / 3)
            } else {
              barW = 1
            }
            pileupCtx.fillRect(cx - barW / 2, ibY, barW, featureHeightSetting)
            if (!isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP) {
              pileupCtx.fillRect(cx - 1.5, ibY, 3, 1)
              pileupCtx.fillRect(cx - 1.5, ibY + featureHeightSetting - 1, 3, 1)
            }
            if (isLarge) {
              pileupCtx.fillStyle = 'white'
              pileupCtx.font = '9px sans-serif'
              pileupCtx.textAlign = 'center'
              pileupCtx.textBaseline = 'middle'
              pileupCtx.fillText(`${len}`, cx, ibY + featureHeightSetting / 2)
            }
          } else {
            const barWidthBp = Math.max(bpPerPx, Math.min(2 * bpPerPx, 1))
            const bw = Math.max(barWidthBp / bpPerPx, 1)
            pileupCtx.fillStyle = ibType === 2 ? softclipColor : hardclipColor
            pileupCtx.fillRect(cx - bw / 2, ibY, bw, featureHeightSetting)
          }
        }

        if (model.showModifications && data.numModifications > 0) {
          for (let i = 0; i < data.numModifications; i++) {
            const pos = regionStart + data.modificationPositions[i]!
            if (pos < block.start || pos > block.end) {
              continue
            }
            const mx = (pos - block.start) / bpPerPx + blockScreenX
            const mw = Math.max(1 / bpPerPx, 0.5)
            const my = data.modificationYs[i]! * rowHeight
            const r = data.modificationColors[i * 4]!
            const g = data.modificationColors[i * 4 + 1]!
            const b = data.modificationColors[i * 4 + 2]!
            const a = data.modificationColors[i * 4 + 3]! / 255
            pileupCtx.globalAlpha = a
            pileupCtx.fillStyle = `rgb(${r},${g},${b})`
            pileupCtx.fillRect(mx, my, mw, featureHeightSetting)
          }
          pileupCtx.globalAlpha = 1
        }
      }
    } else {
      for (let i = 0; i < numReads; i++) {
        const startBp = regionStart + readPositions[i * 2]!
        const endBp = regionStart + readPositions[i * 2 + 1]!
        if (endBp < block.start || startBp > block.end) {
          continue
        }
        const clippedStart = Math.max(startBp, block.start)
        const clippedEnd = Math.min(endBp, block.end)
        const x = (clippedStart - block.start) / bpPerPx + blockScreenX
        const x2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
        const w = Math.max(x2 - x, 0.5)
        const y = pileupTopOffset + readYs[i]! * rowHeight
        const color = getReadColor(
          i,
          data,
          colorSchemeIndex,
          palette,
          data.insertSizeStats,
        )
        content += `<rect x="${x}" y="${y}" width="${w}" height="${featureHeightSetting}" fill="${color}"/>`
      }

      if (model.showMismatches) {
        const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } =
          data
        for (let i = 0; i < numMismatches; i++) {
          const pos = regionStart + mismatchPositions[i]!
          if (pos < block.start || pos > block.end) {
            continue
          }
          const x = (pos - block.start) / bpPerPx + blockScreenX
          const w = Math.max(1 / bpPerPx, 0.5)
          const y = pileupTopOffset + mismatchYs[i]! * rowHeight
          const base = String.fromCharCode(mismatchBases[i]!)
          const basePalette: Record<string, RGBColor> = {
            A: palette.colorBaseA,
            C: palette.colorBaseC,
            G: palette.colorBaseG,
            T: palette.colorBaseT,
          }
          const color = basePalette[base]
            ? rgb255(basePalette[base])
            : rgb255(palette.colorNostrand)
          content += `<rect x="${x}" y="${y}" width="${w}" height="${featureHeightSetting}" fill="${color}"/>`
        }

        const pxPerBp = 1 / bpPerPx
        const deletionColor = rgb255(palette.colorDeletion)
        const skipColor = rgb255(palette.colorSkip)
        for (let i = 0; i < data.numGaps; i++) {
          const startBp = regionStart + data.gapPositions[i * 2]!
          const endBp = regionStart + data.gapPositions[i * 2 + 1]!
          if (endBp < block.start || startBp > block.end) {
            continue
          }
          const gapType = data.gapTypes[i]!
          const clippedStart = Math.max(startBp, block.start)
          const clippedEnd = Math.min(endBp, block.end)
          const gx = (clippedStart - block.start) / bpPerPx + blockScreenX
          const gx2 = (clippedEnd - block.start) / bpPerPx + blockScreenX
          const gw = Math.max(gx2 - gx, 0.5)
          const gy = pileupTopOffset + data.gapYs[i]! * rowHeight

          if (gapType === 0) {
            const widthPx = (endBp - startBp) * pxPerBp
            const alpha = widthPx < 1 && data.gapFrequencies[i] === 0 ? widthPx * widthPx : 1
            if (alpha > 0) {
              content += `<rect x="${gx}" y="${gy}" width="${gw}" height="${featureHeightSetting}" fill="${deletionColor}" fill-opacity="${alpha}"/>`
            }
          } else {
            const midY = gy + featureHeightSetting * 0.5
            content += `<line x1="${gx}" y1="${midY}" x2="${gx + gw}" y2="${midY}" stroke="${skipColor}" stroke-width="1"/>`
          }
        }

        const insertionColor = rgb255(palette.colorInsertion)
        const softclipColor = rgb255(palette.colorSoftclip)
        const hardclipColor = rgb255(palette.colorHardclip)
        for (let i = 0; i < data.numInterbases; i++) {
          const pos = regionStart + data.interbasePositions[i]!
          if (pos < block.start || pos > block.end) {
            continue
          }
          const ibType = data.interbaseTypes[i]!
          const ibY = pileupTopOffset + data.interbaseYs[i]! * rowHeight
          const cx = (pos - block.start) / bpPerPx + blockScreenX

          if (ibType === 1) {
            const len = data.interbaseLengths[i]!
            const isLong = len >= LONG_INSERTION_MIN_LENGTH
            const insertionWidthPx = len * pxPerBp
            const canShowText = insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX && pxPerBp >= INSERTION_TEXT_MIN_PX_PER_BP
            const isLarge = isLong && canShowText
            let barW: number
            if (isLarge) {
              const digits = len < 10 ? 1 : len < 100 ? 2 : len < 1000 ? 3 : len < 10000 ? 4 : 5
              barW = digits * 6 + 10
            } else if (isLong) {
              barW = Math.min(5, insertionWidthPx / 3)
            } else {
              barW = 1
            }
            content += `<rect x="${cx - barW / 2}" y="${ibY}" width="${barW}" height="${featureHeightSetting}" fill="${insertionColor}"/>`
            if (!isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP) {
              const tickW = 3
              content += `<rect x="${cx - tickW / 2}" y="${ibY}" width="${tickW}" height="1" fill="${insertionColor}"/>`
              content += `<rect x="${cx - tickW / 2}" y="${ibY + featureHeightSetting - 1}" width="${tickW}" height="1" fill="${insertionColor}"/>`
            }
            if (isLarge) {
              const textY = ibY + featureHeightSetting / 2
              content += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="white">${len}</text>`
            }
          } else {
            const barWidthBp = Math.max(bpPerPx, Math.min(2 * bpPerPx, 1))
            const bw = Math.max(barWidthBp / bpPerPx, 1)
            const color = ibType === 2 ? softclipColor : hardclipColor
            content += `<rect x="${cx - bw / 2}" y="${ibY}" width="${bw}" height="${featureHeightSetting}" fill="${color}"/>`
          }
        }

        if (model.showModifications && data.numModifications > 0) {
          for (let i = 0; i < data.numModifications; i++) {
            const pos = regionStart + data.modificationPositions[i]!
            if (pos < block.start || pos > block.end) {
              continue
            }
            const mx = (pos - block.start) / bpPerPx + blockScreenX
            const mw = Math.max(1 / bpPerPx, 0.5)
            const my = pileupTopOffset + data.modificationYs[i]! * rowHeight
            const r = data.modificationColors[i * 4]!
            const g = data.modificationColors[i * 4 + 1]!
            const b = data.modificationColors[i * 4 + 2]!
            const a = data.modificationColors[i * 4 + 3]! / 255
            content += `<rect x="${mx}" y="${my}" width="${mw}" height="${featureHeightSetting}" fill="rgb(${r},${g},${b})" fill-opacity="${a}"/>`
          }
        }
      }
    }

    if (showCoverage && showInterbaseIndicators) {
      const { regionStart } = data

      const insertionColor = rgb255(palette.colorInsertion)
      const softclipColor = rgb255(palette.colorSoftclip)
      const hardclipColor = rgb255(palette.colorHardclip)
      const noncovColors = [insertionColor, softclipColor, hardclipColor]

      const noncovHeight = 15
      const indicatorTriangleH = 4.5
      for (let i = 0; i < data.numNoncovSegments; i++) {
        const pos = regionStart + data.noncovPositions[i]!
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
        content += `<rect x="${cx - 0.5}" y="${segTopPx}" width="1" height="${segHeightPx}" fill="${color}"/>`
      }

      for (let i = 0; i < data.numIndicators; i++) {
        const pos = regionStart + data.indicatorPositions[i]!
        if (pos < block.start || pos > block.end) {
          continue
        }
        const cx = (pos - block.start) / bpPerPx + blockScreenX
        const colorType = data.indicatorColorTypes[i]!
        const color = noncovColors[colorType - 1] ?? noncovColors[0]!
        const hw = 3.5
        content += `<polygon points="${cx - hw},0 ${cx + hw},0 ${cx},${indicatorTriangleH}" fill="${color}"/>`
      }
    }
  }

  const displayHeight = model.height
  if (showCoverage) {
    const separatorColor = theme.palette.grey[500]
    content += `<line x1="0" y1="${coverageHeight}" x2="${totalWidth}" y2="${coverageHeight}" stroke="${separatorColor}" stroke-width="1"/>`
  }

  const clipId = 'alignments-clip'
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={totalWidth} height={displayHeight} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g dangerouslySetInnerHTML={{ __html: content }} />
        {arcsCanvas ? (
          <image
            x={0}
            y={showCoverage ? coverageHeight : 0}
            width={totalWidth}
            height={arcsHeight}
            xlinkHref={arcsCanvas.toDataURL('image/png')}
          />
        ) : null}
        {pileupCanvas ? (
          <image
            x={0}
            y={pileupTopOffset}
            width={totalWidth}
            height={pileupHeight}
            xlinkHref={pileupCanvas.toDataURL('image/png')}
          />
        ) : null}
      </g>
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <CoverageYScaleBar model={model} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
