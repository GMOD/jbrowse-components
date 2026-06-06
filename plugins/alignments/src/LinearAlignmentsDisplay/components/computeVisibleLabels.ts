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
  insertionBarWidth,
} from '../constants.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'softclip' | 'hardclip' | 'mismatch'
  x: number
  y: number
  text: string
  fontSize: number
}

interface LabelView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

interface ComputeVisibleLabelsParams {
  view: LabelView
  laidOutPileupMap: { get(idx: number): PileupDataResult | undefined }
  height: number
  featureHeight: number
  featureSpacing: number
  showMismatches: boolean
  topOffset: number
  scrollTop: number
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const {
    view,
    laidOutPileupMap,
    height,
    featureHeight,
    featureSpacing,
    showMismatches,
    topOffset,
    scrollTop,
  } = params

  const labels: VisibleLabel[] = []

  if (!showMismatches) {
    return labels
  }

  const rowHeight = featureHeight + featureSpacing
  const fontSize = computeLabelFontSize(featureHeight)
  const { bpPerPx } = view
  const pxPerBp = 1 / bpPerPx
  const tallEnoughForText = featureHeight >= MIN_HEIGHT_FOR_TEXT
  const canRenderText = pxPerBp >= 6.5 && tallEnoughForText
  const rowYPx = (y: number) =>
    y * rowHeight + featureHeight / 2 - scrollTop + topOffset
  const rowYInRange = (yPx: number) => yPx >= topOffset && yPx <= height
  const clipPrefix: Record<number, string | undefined> = {
    [INTERBASE_SOFTCLIP]: 'S',
    [INTERBASE_HARDCLIP]: 'H',
  }

  for (const vr of view.visibleRegions) {
    const rpcData = laidOutPileupMap.get(vr.displayedRegionIndex)
    if (!rpcData) {
      continue
    }
    const blockStart = vr.start
    const blockEnd = vr.end
    const blockScreenOffsetPx = vr.screenStartPx
    const reversed = vr.reversed ?? false
    const bpEdge = reversed ? blockEnd : blockStart
    const bpToPx = (bp: number) =>
      (reversed ? bpEdge - bp : bp - bpEdge) / bpPerPx + blockScreenOffsetPx

    // Screen-x spans of the wide purple boxes the GPU draws for large
    // insertions (insertion.slang), keyed by integer pileup row. A SNP letter
    // landing on one reads as a "purple SNP", so — matching hit-testing — the
    // insertion wins and the mismatch loop drops any letter it shadows.
    const insertionShadows: { row: number; x0: number; x1: number }[] = []

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
        if (insertionType === 'large') {
          const halfW = insertionBarWidth(length, pxPerBp) / 2
          insertionShadows.push({
            row: interbaseYs[i]!,
            x0: xPx - halfW,
            x1: xPx + halfW,
          })
          if (tallEnoughForText) {
            labels.push({
              type: 'insertion',
              x: xPx,
              y: yPx,
              text: String(length),
              fontSize,
            })
          }
        } else if (insertionType === 'small' && canRenderText) {
          labels.push({
            type: 'insertion',
            x: xPx + 3,
            y: yPx,
            text: `(${length})`,
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

        const row = mismatchYs[i]!
        const yPx = rowYPx(row)
        if (!rowYInRange(yPx)) {
          continue
        }

        // Midpoint of the 1bp SNP rect; the average is orientation-independent.
        const centerPx = (bpToPx(pos) + bpToPx(pos + 1)) / 2

        // Insertion wins: drop the letter when a large insertion box on this
        // row covers its center, otherwise it sits on purple and looks like a
        // SNP.
        const shadowed = insertionShadows.some(
          s => s.row === row && centerPx >= s.x0 && centerPx <= s.x1,
        )
        if (shadowed) {
          continue
        }

        labels.push({
          type: 'mismatch',
          x: centerPx,
          y: yPx,
          text: String.fromCharCode(mismatchBases[i]!),
          fontSize,
        })
      }
    }
  }

  return labels
}
