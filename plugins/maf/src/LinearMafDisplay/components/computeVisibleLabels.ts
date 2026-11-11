import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { DASH, LOWER_BIT, isGapByte } from '@jbrowse/core/util/alignedBytes'

import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'
import { paintsOwnColor } from '../../LinearMafRenderer/resolveCellColor.ts'
import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'

import type { BasePaints } from '../../LinearMafRenderer/resolveCellColor.ts'
import type { MafOverlayParams } from './visibleRegionGeometry.ts'

export interface VisibleLabel {
  x: number
  y: number
  text: string
  lowerBase: string
}

interface ComputeVisibleLabelsParams extends MafOverlayParams {
  paints: BasePaints
}

/**
 * A letter over every cell that paints its base's color, in the case the file
 * gives it: the mismatches, or every base under the `base` layer.
 */
export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const { view, rpcDataMap, rowHeight, paints } = params

  const labels: VisibleLabel[] = []
  const { h, offset } = rowBandGeometry(params)
  // Gated on the same zoom and row height as the insertion and deletion count
  // labels, so all row text reveals together.
  if (1 / view.bpPerPx >= CHAR_SIZE_WIDTH && h >= MIN_HEIGHT_FOR_TEXT) {
    const hp2 = h / 2

    for (const {
      data,
      bpToPx,
      overlaps,
      bpLo,
      bpHi,
      regionStart,
      regionEnd,
    } of eachVisibleRegion(view, rpcDataMap)) {
      const firstCellBp = Math.max(regionStart, bpLo) - 0.5
      const endCellBp = Math.min(regionEnd, bpHi) - 0.5
      for (const block of data.blocks) {
        if (!overlaps(block.startBp, block.endBp)) {
          continue
        }
        const refSeqBytes = block.refSeqBytes
        // Found once a block, not once a row: one TAF/bigMaf stanza can span
        // the whole buffered region, and every row shares the reference's
        // columns.
        let firstCol = 0
        let firstOffset = 0
        while (
          firstCol < refSeqBytes.length &&
          block.startBp + firstOffset < firstCellBp
        ) {
          if (refSeqBytes[firstCol] !== DASH) {
            firstOffset++
          }
          firstCol++
        }

        for (const row of block.rows) {
          const alignmentBytes = row.alignmentBytes
          const rowTop = offset + rowHeight * row.rowIndex
          const yPos = Math.round(hp2 + rowTop)
          // Defensive min() guards malformed files (worker output should match).
          const len = Math.min(alignmentBytes.length, refSeqBytes.length)

          // Hot loop: work on bytes to skip a per-row TextDecoder.decode().
          for (let i = firstCol, genomicOffset = firstOffset; i < len; i++) {
            const refCode = refSeqBytes[i]!
            if (refCode !== DASH) {
              const bp = block.startBp + genomicOffset
              // The cell center must be inside the displayed region and near
              // the screen. `bp` only increases, so the right edge ends the
              // row's walk.
              if (bp >= endCellBp) {
                break
              }
              const alnCode = alignmentBytes[i]!
              if (
                !isGapByte(alnCode) &&
                paintsOwnColor(refCode, alnCode, paints)
              ) {
                labels.push({
                  // +0.5 → cell center, orientation-aware via bpToPx
                  x: bpToPx(bp + 0.5),
                  y: yPos,
                  text: String.fromCharCode(alnCode),
                  lowerBase: String.fromCharCode(alnCode | LOWER_BIT),
                })
              }
              genomicOffset++
            }
          }
        }
      }
    }
  }

  return labels
}
