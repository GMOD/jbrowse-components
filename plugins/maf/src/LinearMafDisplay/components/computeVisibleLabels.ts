import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'

import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

import type { MafOverlayParams } from './visibleRegionGeometry.ts'

export interface VisibleLabel {
  x: number
  y: number
  text: string
  lowerBase: string
}

interface ComputeVisibleLabelsParams extends MafOverlayParams {
  showAllLetters: boolean
  showAsUpperCase: boolean
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const { view, rpcDataMap, rowHeight, showAllLetters, showAsUpperCase } =
    params

  const labels: VisibleLabel[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // Gate base/SNP letters on the same zoom + row height as the insertion and
  // deletion count labels, so all row text reveals together (rather than letters
  // showing on rows too short for the insertion/deletion counts to draw).
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

        // Hot per-cell loop: work directly on bytes (skips a per-row
        // TextDecoder.decode() that would allocate a string only to be
        // immediately reduced to char codes). ASCII bit math matches
        // resolveCellColor's `(byte | 0x20)` match check.
        for (let i = 0, genomicOffset = 0; i < len; i++) {
          const refCode = refSeqBytes[i]!
          if (refCode !== DASH) {
            const bp = block.startBp + genomicOffset
            // The block cull applied per column, because a block is not a
            // screenful: one TAF/bigMaf stanza can span the whole buffered
            // region, three times the canvas, so most of its columns emit a
            // label the overlay then draws off the edge. `bp` only ever
            // increases, so the right edge ends the row's walk rather than
            // filtering the rest of it.
            if (bp >= bpHi) {
              break
            }
            const alnCode = alignmentBytes[i]!
            if (bp >= bpLo && alnCode !== DASH && alnCode !== SPACE) {
              const isMatch = (refCode | LOWER_BIT) === (alnCode | LOWER_BIT)
              if (showAllLetters || !isMatch) {
                const displayCode = showAsUpperCase
                  ? alnCode & ~LOWER_BIT
                  : alnCode
                labels.push({
                  // +0.5 → cell center, orientation-aware via bpToPx
                  x: bpToPx(bp + 0.5),
                  y: yPos,
                  text: String.fromCharCode(displayCode),
                  lowerBase: String.fromCharCode(alnCode | LOWER_BIT),
                })
              }
            }
            genomicOffset++
          }
        }
      }
    }
  }

  return labels
}
