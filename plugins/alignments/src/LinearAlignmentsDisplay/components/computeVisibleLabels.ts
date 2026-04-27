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
  reversed: boolean
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
    const {
      rpcData,
      blockStart,
      blockEnd,
      blockScreenOffsetPx,
      bpPerPx,
      reversed,
    } = block
    const bpEdge = reversed ? blockEnd : blockStart
    const bpToPx = (bp: number) =>
      (reversed ? bpEdge - bp : bp - bpEdge) / bpPerPx + blockScreenOffsetPx
    const pxPerBp = 1 / bpPerPx
    const charWidth = 6.5
    const tallEnoughForText = featureHeightSetting >= MIN_HEIGHT_FOR_TEXT
    const canRenderText = pxPerBp >= charWidth && tallEnoughForText

    const rowYPx = (y: number) =>
      y * rowHeight + featureHeightSetting / 2 - rangeY[0] + topOffset
    const rowYInRange = (yPx: number) => yPx >= topOffset && yPx <= height

    // Process deletions (gaps)
    const { gapPositions, gapYs, gapLengths, gapTypes } = rpcData
    const numGaps = gapPositions.length / 2
    if (tallEnoughForText) {
      for (let i = 0; i < numGaps; i++) {
        if (gapTypes[i] !== 0) {
          continue
        }

        const gapStart = gapPositions[i * 2]!
        const gapEnd = gapPositions[i * 2 + 1]!
        const length = gapLengths[i]!

        if (gapEnd < blockStart || gapStart > blockEnd) {
          continue
        }

        const rawStartPx = bpToPx(gapStart)
        const rawEndPx = bpToPx(gapEnd)
        const startPx = Math.min(rawStartPx, rawEndPx)
        const endPx = Math.max(rawStartPx, rawEndPx)
        const widthPx = endPx - startPx

        const lengthStr = String(length)
        const textWidth = measureText(lengthStr, fontSize)

        if (widthPx < textWidth) {
          continue
        }

        const yPx = rowYPx(gapYs[i]!)
        if (!rowYInRange(yPx)) {
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
    } = rpcData
    const numInterbases = interbasePositions.length

    const clipPrefix: Record<number, string | undefined> = {
      [INTERBASE_SOFTCLIP]: 'S',
      [INTERBASE_HARDCLIP]: 'H',
    }

    for (let i = 0; i < numInterbases; i++) {
      const pos = interbasePositions[i]!
      const length = interbaseLengths[i]!
      const type = interbaseTypes[i]!

      if (pos < blockStart || pos > blockEnd) {
        continue
      }

      const yPx = rowYPx(interbaseYs[i]!)
      if (!rowYInRange(yPx)) {
        continue
      }
      const xPx = bpToPx(pos)

      if (type === INTERBASE_INSERTION) {
        const insertionType = getInsertionType(length, pxPerBp)
        if (insertionType === 'large' && tallEnoughForText) {
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
      } else if (canRenderText) {
        const prefix = clipPrefix[type]
        if (prefix !== undefined) {
          labels.push({
            type: type === INTERBASE_SOFTCLIP ? 'softclip' : 'hardclip',
            x: xPx + 3,
            y: yPx,
            text: `(${prefix}${length})`,
            width: 0,
            fontSize,
          })
        }
      }
    }

    // Process mismatches
    const { mismatchPositions, mismatchYs, mismatchBases } = rpcData
    const numMismatches = mismatchPositions.length
    if (canRenderText) {
      for (let i = 0; i < numMismatches; i++) {
        const pos = mismatchPositions[i]!

        if (pos < blockStart || pos + 1 > blockEnd) {
          continue
        }

        const yPx = rowYPx(mismatchYs[i]!)
        if (!rowYInRange(yPx)) {
          continue
        }

        const rawStartPx = bpToPx(pos)
        const rawEndPx = bpToPx(pos + 1)
        const startPx = Math.min(rawStartPx, rawEndPx)
        const endPx = Math.max(rawStartPx, rawEndPx)

        labels.push({
          type: 'mismatch',
          x: (startPx + endPx) / 2,
          y: yPx,
          text: String.fromCharCode(mismatchBases[i]!),
          width: endPx - startPx,
          fontSize,
        })
      }
    }
  }

  return labels
}
