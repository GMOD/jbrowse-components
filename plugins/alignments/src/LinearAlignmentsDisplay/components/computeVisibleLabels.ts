import { measureText } from '@jbrowse/core/util'

import { getInsertionType } from '../model.ts'

import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'softclip' | 'hardclip' | 'mismatch'
  x: number
  y: number
  text: string
  width: number
}

interface ComputeVisibleLabelsParams {
  rpcData: WebGLPileupDataResult | null
  labelBpRange: [number, number] | null
  width: number | undefined
  height: number
  featureHeightSetting: number
  featureSpacing: number
  showMismatches: boolean
  showCoverage: boolean
  coverageHeight: number
  rangeY: [number, number]
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const {
    rpcData,
    labelBpRange,
    width,
    height,
    featureHeightSetting,
    featureSpacing,
    showMismatches,
    showCoverage,
    coverageHeight,
    rangeY,
  } = params

  const labels: VisibleLabel[] = []

  if (!rpcData || !labelBpRange || width === undefined || !showMismatches) {
    return labels
  }

  const bpRange = labelBpRange
  const bpPerPx = (bpRange[1] - bpRange[0]) / width
  const pxPerBp = 1 / bpPerPx
  const charWidth = 6.5
  const minFeatureHeightForText = 5
  const canRenderText =
    pxPerBp >= charWidth && featureHeightSetting >= minFeatureHeightForText
  const rowHeight = featureHeightSetting + featureSpacing
  const pileupYOffset = showCoverage ? coverageHeight : 0
  const minLabelWidth = 15

  // Process deletions (gaps)
  const { gapPositions, gapYs, gapLengths, gapTypes, numGaps, regionStart } =
    rpcData
  if (featureHeightSetting >= minFeatureHeightForText) {
    for (let i = 0; i < numGaps; i++) {
      if (gapTypes[i] !== 0) {
        continue
      }

      const startOffset = gapPositions[i * 2]!
      const endOffset = gapPositions[i * 2 + 1]!
      const length = gapLengths[i]!
      const y = gapYs[i]!

      const gapStart = regionStart + startOffset
      const gapEnd = regionStart + endOffset

      if (gapEnd < bpRange[0] || gapStart > bpRange[1]) {
        continue
      }

      const startPx = (gapStart - bpRange[0]) / bpPerPx
      const endPx = (gapEnd - bpRange[0]) / bpPerPx
      const widthPx = endPx - startPx

      const lengthStr = String(length)
      const textWidth = measureText(lengthStr, 10)

      if (widthPx < textWidth) {
        continue
      }

      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      labels.push({
        type: 'deletion',
        x: (startPx + endPx) / 2,
        y: yPx,
        text: lengthStr,
        width: widthPx,
      })
    }
  }

  // Process insertions
  const { insertionPositions, insertionYs, insertionLengths, numInsertions } =
    rpcData
  for (let i = 0; i < numInsertions; i++) {
    const posOffset = insertionPositions[i]!
    const length = insertionLengths[i]!
    const y = insertionYs[i]!

    const pos = regionStart + posOffset

    if (pos < bpRange[0] || pos > bpRange[1]) {
      continue
    }

    const xPx = (pos - bpRange[0]) / bpPerPx
    const yPx =
      y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

    if (yPx < pileupYOffset || yPx > height) {
      continue
    }

    const insertionType = getInsertionType(length, pxPerBp)

    if (insertionType === 'large' && canRenderText) {
      labels.push({
        type: 'insertion',
        x: xPx,
        y: yPx,
        text: String(length),
        width: 0,
      })
    } else if (insertionType === 'small' && canRenderText) {
      labels.push({
        type: 'insertion',
        x: xPx + 3,
        y: yPx,
        text: `(${length})`,
        width: 0,
      })
    }
  }

  // Process soft clips
  const { softclipPositions, softclipYs, softclipLengths, numSoftclips } =
    rpcData
  if (canRenderText) {
    for (let i = 0; i < numSoftclips; i++) {
      const posOffset = softclipPositions[i]!
      const length = softclipLengths[i]!
      const y = softclipYs[i]!

      const pos = regionStart + posOffset

      if (pos < bpRange[0] || pos > bpRange[1]) {
        continue
      }

      const xPx = (pos - bpRange[0]) / bpPerPx
      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      labels.push({
        type: 'softclip',
        x: xPx,
        y: yPx,
        text: `(S${length})`,
        width: 0,
      })
    }
  }

  // Process hard clips
  const { hardclipPositions, hardclipYs, hardclipLengths, numHardclips } =
    rpcData
  if (canRenderText) {
    for (let i = 0; i < numHardclips; i++) {
      const posOffset = hardclipPositions[i]!
      const length = hardclipLengths[i]!
      const y = hardclipYs[i]!

      const pos = regionStart + posOffset

      if (pos < bpRange[0] || pos > bpRange[1]) {
        continue
      }

      const xPx = (pos - bpRange[0]) / bpPerPx
      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      labels.push({
        type: 'hardclip',
        x: xPx,
        y: yPx,
        text: `(H${length})`,
        width: 0,
      })
    }
  }

  // Process mismatches - show base letter when zoomed in enough
  const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } =
    rpcData
  if (canRenderText) {
    for (let i = 0; i < numMismatches; i++) {
      const posOffset = mismatchPositions[i]!
      const baseCode = mismatchBases[i]!
      const y = mismatchYs[i]!

      const pos = regionStart + posOffset

      if (pos < bpRange[0] || pos + 1 > bpRange[1]) {
        continue
      }

      const startPx = (pos - bpRange[0]) / bpPerPx
      const endPx = (pos + 1 - bpRange[0]) / bpPerPx
      const xPx = (startPx + endPx) / 2

      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + pileupYOffset

      if (yPx < pileupYOffset || yPx > height) {
        continue
      }

      labels.push({
        type: 'mismatch',
        x: xPx,
        y: yPx,
        text: String.fromCharCode(baseCode),
        width: endPx - startPx,
      })
    }
  }

  return labels
}
