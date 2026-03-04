import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderSvgModel {
  rpcDataMap: Map<number, FeatureDataResult>
  error: unknown
  regionTooLarge: boolean
}

function rgbaColor(colors: Uint8Array, i: number) {
  const r = colors[i * 4]!
  const g = colors[i * 4 + 1]!
  const b = colors[i * 4 + 2]!
  const a = colors[i * 4 + 3]!
  return { rgb: `rgb(${r},${g},${b})`, opacity: a / 255 }
}

function fillAttrs(colors: Uint8Array, i: number) {
  const { rgb, opacity } = rgbaColor(colors, i)
  return opacity === 1
    ? `fill="${rgb}"`
    : `fill="${rgb}" fill-opacity="${opacity.toFixed(3)}"`
}

function strokeAttr(colors: Uint8Array, i: number) {
  const { rgb, opacity } = rgbaColor(colors, i)
  return opacity === 1
    ? `stroke="${rgb}"`
    : `stroke="${rgb}" stroke-opacity="${opacity.toFixed(3)}"`
}

function bpToScreenX(
  bpPos: number,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
) {
  const blockWidth = screenEndPx - screenStartPx
  const regionLengthBp = regionEnd - regionStart
  return screenStartPx + ((bpPos - regionStart) / regionLengthBp) * blockWidth
}

function renderRectsForRegion(
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  scrollY: number,
) {
  let content = ''
  const {
    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    numRects,
    regionStart: dataRegionStart,
  } = data

  for (let i = 0; i < numRects; i++) {
    const startBp = dataRegionStart + rectPositions[i * 2]!
    const endBp = dataRegionStart + rectPositions[i * 2 + 1]!

    if (endBp < regionStart || startBp > regionEnd) {
      continue
    }

    const clippedStart = Math.max(startBp, regionStart)
    const clippedEnd = Math.min(endBp, regionEnd)

    const x = bpToScreenX(
      clippedStart,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
    )
    const x2 = bpToScreenX(
      clippedEnd,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
    )
    const w = Math.max(x2 - x, 0.5)
    const y = rectYs[i]! - scrollY
    const h = rectHeights[i]!
    content += `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttrs(rectColors, i)}/>`
  }
  return content
}

function renderLinesForRegion(
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  scrollY: number,
) {
  let content = ''
  const {
    linePositions,
    lineYs,
    lineColors,
    lineDirections,
    numLines,
    regionStart: dataRegionStart,
  } = data
  const blockWidth = screenEndPx - screenStartPx
  const regionLengthBp = regionEnd - regionStart
  const bpPerPx = regionLengthBp / blockWidth

  for (let i = 0; i < numLines; i++) {
    const startBp = dataRegionStart + linePositions[i * 2]!
    const endBp = dataRegionStart + linePositions[i * 2 + 1]!

    if (endBp < regionStart || startBp > regionEnd) {
      continue
    }

    const clippedStart = Math.max(startBp, regionStart)
    const clippedEnd = Math.min(endBp, regionEnd)

    const x1 = bpToScreenX(
      clippedStart,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
    )
    const x2 = bpToScreenX(
      clippedEnd,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
    )
    const y = rectRound(lineYs[i]! - scrollY)
    const lineStroke = strokeAttr(lineColors, i)
    const direction = lineDirections[i]!

    content += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" ${lineStroke} stroke-width="1"/>`

    if (direction !== 0) {
      const lineWidthPx = (endBp - startBp) / bpPerPx
      const chevronSpacing = 25
      const totalChevrons = Math.max(
        1,
        Math.floor(lineWidthPx / chevronSpacing),
      )
      const bpSpacing = (endBp - startBp) / (totalChevrons + 1)
      const chevronW = 4.5
      const chevronH = 3.5

      for (let c = 1; c <= totalChevrons; c++) {
        const chevronBp = startBp + bpSpacing * c
        if (chevronBp < regionStart || chevronBp > regionEnd) {
          continue
        }
        const cx = bpToScreenX(
          chevronBp,
          regionStart,
          regionEnd,
          screenStartPx,
          screenEndPx,
        )
        const tipX = cx + chevronW * 0.5 * direction
        const baseX = cx - chevronW * 0.5 * direction

        content += `<polyline points="${baseX},${y - chevronH} ${tipX},${y} ${baseX},${y + chevronH}" fill="none" ${lineStroke} stroke-width="1"/>`
      }
    }
  }
  return content
}

function renderArrowsForRegion(
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  scrollY: number,
) {
  let content = ''
  const {
    arrowXs,
    arrowYs,
    arrowDirections,
    arrowHeights,
    arrowColors,
    numArrows,
    regionStart: dataRegionStart,
  } = data

  for (let i = 0; i < numArrows; i++) {
    const bpPos = dataRegionStart + arrowXs[i]!

    if (bpPos < regionStart || bpPos > regionEnd) {
      continue
    }

    const cx = bpToScreenX(
      bpPos,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
    )
    const cy = arrowYs[i]! - scrollY
    const dir = arrowDirections[i]!
    const h = arrowHeights[i]!
    const arrowStroke = strokeAttr(arrowColors, i)
    const arrowFill = fillAttrs(arrowColors, i)

    const stemLength = 7
    const stemHalf = 0.5
    const headWidth = 3.5
    const headHalf = Math.min(2.5, h * 0.4)

    const stemStartX = cx - stemLength * 0.5 * dir
    const stemEndX = cx + stemLength * 0.5 * dir

    content += `<line x1="${stemStartX}" y1="${cy}" x2="${stemEndX}" y2="${cy}" ${arrowStroke} stroke-width="${stemHalf * 2}"/>`

    const tipX = stemEndX + headWidth * dir
    content += `<polygon points="${stemEndX},${cy - headHalf} ${tipX},${cy} ${stemEndX},${cy + headHalf}" ${arrowFill}/>`
  }
  return content
}

function rectRound(v: number) {
  return Math.round(v * 2) / 2
}

function renderLabelsForRegion(
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
) {
  let content = ''
  const { floatingLabelsData, regionStart: dataRegionStart } = data

  const blockBpPerPx = (regionEnd - regionStart) / (screenEndPx - screenStartPx)
  const fontSize = 11

  for (const labelData of Object.values(floatingLabelsData)) {
    const featureStartBp = labelData.minX + dataRegionStart
    const featureEndBp = labelData.maxX + dataRegionStart

    if (featureEndBp < regionStart || featureStartBp > regionEnd) {
      continue
    }

    const featureLeftPx =
      screenStartPx + (featureStartBp - regionStart) / blockBpPerPx
    const featureRightPx =
      screenStartPx + (featureEndBp - regionStart) / blockBpPerPx
    const featureWidth = featureRightPx - featureLeftPx
    const featureBottomPx = labelData.topY + labelData.featureHeight

    const emitLabel = (
      label: {
        text: string
        relativeY: number
        color: string
        textWidth: number
        isOverlay?: boolean
      },
      padding: number,
    ) => {
      const labelY = featureBottomPx + label.relativeY + padding
      const labelX =
        label.textWidth > featureWidth
          ? featureLeftPx
          : Math.min(
              Math.max(Math.max(screenStartPx, featureLeftPx), 0),
              featureRightPx - label.textWidth,
            )

      if (label.isOverlay) {
        content += `<rect x="${labelX - 1}" y="${labelY}" width="${label.textWidth + 2}" height="${fontSize + 1}" fill="rgb(255,255,255)" fill-opacity="0.8"/>`
      }
      const escaped = label.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      content += `<text x="${labelX}" y="${labelY + fontSize}" font-size="${fontSize}" fill="${label.color}" style="pointer-events:none">${escaped}</text>`
    }

    if (labelData.nameLabel) {
      emitLabel(labelData.nameLabel, 2)
    }
    if (labelData.descriptionLabel) {
      emitLabel(labelData.descriptionLabel, 2)
    }
    if (labelData.subfeatureLabel) {
      emitLabel(labelData.subfeatureLabel, 0)
    }
  }
  return content
}

function renderPeptideLettersForRegion(
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
) {
  let content = ''
  const { aminoAcidOverlay } = data
  if (!aminoAcidOverlay) {
    return content
  }

  const blockBpPerPx = (regionEnd - regionStart) / (screenEndPx - screenStartPx)

  for (const item of aminoAcidOverlay) {
    if (item.endBp < regionStart || item.startBp > regionEnd) {
      continue
    }

    const leftPx = screenStartPx + (item.startBp - regionStart) / blockBpPerPx
    const rightPx = screenStartPx + (item.endBp - regionStart) / blockBpPerPx
    const centerPx = (leftPx + rightPx) / 2
    const fontSize = Math.min(item.heightPx - 2, 12)
    const color = item.isStopOrNonTriplet ? 'red' : 'black'
    const label = `${item.aminoAcid}${item.proteinIndex + 1}`
    const y = item.topPx + item.heightPx / 2 + fontSize / 3

    content += `<text x="${centerPx}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" style="pointer-events:none">${label}</text>`
  }
  return content
}

export async function renderSvg(
  model: RenderSvgModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
  const { rpcDataMap } = model

  if (rpcDataMap.size === 0) {
    return null
  }

  const visibleRegions = view.visibleRegions as {
    regionNumber: number
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
  }[]

  const scrollY = 0
  const renderPeptides = shouldRenderPeptideText(view.bpPerPx)

  let content = ''

  for (const vr of visibleRegions) {
    const data = rpcDataMap.get(vr.regionNumber)
    if (!data) {
      continue
    }

    content += renderLinesForRegion(
      data,
      vr.start,
      vr.end,
      vr.screenStartPx,
      vr.screenEndPx,
      scrollY,
    )
    content += renderRectsForRegion(
      data,
      vr.start,
      vr.end,
      vr.screenStartPx,
      vr.screenEndPx,
      scrollY,
    )
    content += renderArrowsForRegion(
      data,
      vr.start,
      vr.end,
      vr.screenStartPx,
      vr.screenEndPx,
      scrollY,
    )
    content += renderLabelsForRegion(
      data,
      vr.start,
      vr.end,
      vr.screenStartPx,
      vr.screenEndPx,
    )
    if (renderPeptides) {
      content += renderPeptideLettersForRegion(
        data,
        vr.start,
        vr.end,
        vr.screenStartPx,
        vr.screenEndPx,
      )
    }
  }

  return <g dangerouslySetInnerHTML={{ __html: content }} />
}
