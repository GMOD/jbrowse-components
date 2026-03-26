import { measureText } from '@jbrowse/core/util'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import {
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
  getInsertionType,
} from '../constants.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'softclip' | 'hardclip' | 'mismatch'
  x: number
  y: number
  text: string
  width: number
  fontSize: number
}

interface BlockLabelParams {
  rpcData: PileupDataResult
  blockStart: number
  blockEnd: number
  blockScreenOffsetPx: number
  bpPerPx: number
}

interface ComputeVisibleLabelsParams {
  blocks: BlockLabelParams[]
  height: number
  featureHeightSetting: number
  featureSpacing: number
  showMismatches: boolean
  topOffset: number
  rangeY: [number, number]
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const {
    blocks,
    height,
    featureHeightSetting,
    featureSpacing,
    showMismatches,
    topOffset,
    rangeY,
  } = params

  const labels: VisibleLabel[] = []

  if (!showMismatches || blocks.length === 0) {
    return labels
  }

  const rowHeight = featureHeightSetting + featureSpacing
  const fontSize = computeLabelFontSize(featureHeightSetting)

  for (const block of blocks) {
    const { rpcData, blockStart, blockEnd, blockScreenOffsetPx, bpPerPx } =
      block
    const pxPerBp = 1 / bpPerPx
    const charWidth = 6.5
    const canRenderText =
      pxPerBp >= charWidth && featureHeightSetting >= MIN_HEIGHT_FOR_TEXT
    const { regionStart } = rpcData

    // Process deletions (gaps)
    const { gapPositions, gapYs, gapLengths, gapTypes, numGaps } = rpcData
    if (featureHeightSetting >= MIN_HEIGHT_FOR_TEXT) {
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

        if (gapEnd < blockStart || gapStart > blockEnd) {
          continue
        }

        const startPx = (gapStart - blockStart) / bpPerPx + blockScreenOffsetPx
        const endPx = (gapEnd - blockStart) / bpPerPx + blockScreenOffsetPx
        const widthPx = endPx - startPx

        const lengthStr = String(length)
        const textWidth = measureText(lengthStr, fontSize)

        if (widthPx < textWidth) {
          continue
        }

        const yPx =
          y * rowHeight + featureHeightSetting / 2 - rangeY[0] + topOffset

        if (yPx < topOffset || yPx > height) {
          continue
        }

        labels.push({
          type: 'deletion',
          x: (startPx + endPx) / 2,
          y: yPx,
          text: lengthStr,
          width: widthPx,
          fontSize,
        })
      }
    }

    // Process interbase features (insertions, softclips, hardclips)
    const {
      interbasePositions,
      interbaseYs,
      interbaseLengths,
      interbaseTypes,
      numInterbases,
    } = rpcData

    for (let i = 0; i < numInterbases; i++) {
      const posOffset = interbasePositions[i]!
      const length = interbaseLengths[i]!
      const y = interbaseYs[i]!
      const type = interbaseTypes[i]!

      const pos = regionStart + posOffset

      if (pos < blockStart || pos > blockEnd) {
        continue
      }

      const xPx = (pos - blockStart) / bpPerPx + blockScreenOffsetPx
      const yPx =
        y * rowHeight + featureHeightSetting / 2 - rangeY[0] + topOffset

      if (yPx < topOffset || yPx > height) {
        continue
      }

      if (type === INTERBASE_INSERTION) {
        const insertionType = getInsertionType(length, pxPerBp)

        if (
          insertionType === 'large' &&
          featureHeightSetting >= MIN_HEIGHT_FOR_TEXT
        ) {
          labels.push({
            type: 'insertion',
            x: xPx,
            y: yPx,
            text: String(length),
            width: 0,
            fontSize,
          })
        } else if (insertionType === 'small' && canRenderText) {
          labels.push({
            type: 'insertion',
            x: xPx + 3,
            y: yPx,
            text: `(${length})`,
            width: 0,
            fontSize,
          })
        }
      }

      if (type === INTERBASE_SOFTCLIP && canRenderText) {
        labels.push({
          type: 'softclip',
          x: xPx,
          y: yPx,
          text: `(S${length})`,
          width: 0,
          fontSize,
        })
      }

      if (type === INTERBASE_HARDCLIP && canRenderText) {
        labels.push({
          type: 'hardclip',
          x: xPx,
          y: yPx,
          text: `(H${length})`,
          width: 0,
          fontSize,
        })
      }
    }

    // Process mismatches
    const { mismatchPositions, mismatchYs, mismatchBases, numMismatches } =
      rpcData
    if (canRenderText) {
      for (let i = 0; i < numMismatches; i++) {
        const posOffset = mismatchPositions[i]!
        const baseCode = mismatchBases[i]!
        const y = mismatchYs[i]!

        const pos = regionStart + posOffset

        if (pos < blockStart || pos + 1 > blockEnd) {
          continue
        }

        const startPx = (pos - blockStart) / bpPerPx + blockScreenOffsetPx
        const endPx = (pos + 1 - blockStart) / bpPerPx + blockScreenOffsetPx
        const xPx = (startPx + endPx) / 2

        const yPx =
          y * rowHeight + featureHeightSetting / 2 - rangeY[0] + topOffset

        if (yPx < topOffset || yPx > height) {
          continue
        }

        labels.push({
          type: 'mismatch',
          x: xPx,
          y: yPx,
          text: String.fromCharCode(baseCode),
          width: endPx - startPx,
          fontSize,
        })
      }
    }
  }

  return labels
}
