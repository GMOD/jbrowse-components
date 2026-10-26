import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { DASH, LOWER_BIT, isGapByte } from '@jbrowse/core/util/alignedBytes'

import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'
import { paintsOwnColor } from '../../LinearMafRenderer/resolveCellColor.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

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
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // Gated on the same zoom and row height as the insertion and deletion count
  // labels, so all row text reveals together.
  if (1 / view.bpPerPx < CHAR_SIZE_WIDTH || h < MIN_HEIGHT_FOR_TEXT) {
    return labels
  }

  const hp2 = h / 2

  for (const { data, bpToPx, bpLo, bpHi, overlaps } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of data.blocks) {
      if (!overlaps(block.startBp, block.endBp)) {
        continue
      }
      const refSeqBytes = block.refSeqBytes

      for (const row of block.rows) {
        if (row.rowIndex < firstRow || row.rowIndex >= endRow) {
          continue
        }
        const alignmentBytes = row.alignmentBytes
        const rowTop = offset + rowHeight * row.rowIndex
        const yPos = Math.round(hp2 + rowTop)
        // Defensive min() guards malformed files (worker output should match).
        const len = Math.min(alignmentBytes.length, refSeqBytes.length)

        // Hot loop: work on bytes to skip a per-row TextDecoder.decode().
        for (let i = 0, genomicOffset = 0; i < len; i++) {
          const refCode = refSeqBytes[i]!
          if (refCode !== DASH) {
            const bp = block.startBp + genomicOffset
            // The block cull applied per column, since one TAF/bigMaf stanza
            // can span the whole buffered region. `bp` only increases, so the
            // right edge ends the row's walk.
            if (bp >= bpHi) {
              break
            }
            const alnCode = alignmentBytes[i]!
            if (
              bp >= bpLo &&
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

  return labels
}
