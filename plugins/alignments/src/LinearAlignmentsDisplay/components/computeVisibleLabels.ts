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

interface BlockLabelParams {
  rpcData: WebGLPileupDataResult
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
  const minFeatureHeightForText = 5

  for (const block of blocks) {
    const { rpcData, blockStart, blockEnd, blockScreenOffsetPx, bpPerPx } =
      block
    const pxPerBp = 1 / bpPerPx
    const charWidth = 6.5
    const canRenderText =
      pxPerBp >= charWidth && featureHeightSetting >= minFeatureHeightForText
    const { regionStart } = rpcData

    // Process deletions (gaps)
    const { gapPositions, gapYs, gapLengths, gapTypes, numGaps } = rpcData
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

        if (gapEnd < blockStart || gapStart > blockEnd) {
          continue
        }

        const startPx = (gapStart - blockStart) / bpPerPx + blockScreenOffsetPx
        const endPx = (gapEnd - blockStart) / bpPerPx + blockScreenOffsetPx
        const widthPx = endPx - startPx

        const lengthStr = String(length)
        const textWidth = measureText(lengthStr, 10)

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
      const type = interbaseTypes[i]! // 1=insertion, 2=softclip, 3=hardclip

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

      // Type 1 = insertion
      if (type === 1) {
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

      // Type 2 = softclip
      if (type === 2 && canRenderText) {
        labels.push({
          type: 'softclip',
          x: xPx,
          y: yPx,
          text: `(S${length})`,
          width: 0,
        })
      }

      // Type 3 = hardclip
      if (type === 3 && canRenderText) {
        labels.push({
          type: 'hardclip',
          x: xPx,
          y: yPx,
          text: `(H${length})`,
          width: 0,
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
        })
      }
    }
  }

  return labels
}
