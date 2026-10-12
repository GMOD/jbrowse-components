import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { spanRect } from '@jbrowse/render-core/canvas2dUtils'

import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { makeRowFlank } from '../../LinearMafRenderer/rendering/rowFlank.ts'
import { LABEL_FONT } from '../../LinearMafRenderer/rendering/types.ts'
import { regionDeletionRunBounds } from './mafRowEvents.ts'
import { eachVisibleRegion, rowViewport } from './visibleRegionGeometry.ts'

import type { MafOverlayParams } from './visibleRegionGeometry.ts'

// Narrowest label `drawMafDeletionLabels` could fit: one digit in its monospace
// font plus 2px padding. A run below this cannot draw at any digit count.
// A hard cut where plugin-alignments ramps opacity (`labelFadeOpacity`);
// adopting the ramp is undecided and would move every MAF figure carrying a
// count.
const MIN_LABEL_WIDTH = LABEL_FONT.measure('0') + 2

export interface DeletionMarker {
  /** screen px of the left edge of the run's visible part */
  xLeft: number
  /** screen px width of the run's visible part */
  width: number
  rowTop: number
  h: number
  /** number of deleted reference bases */
  length: number
}

/**
 * Positioned deletion runs for every aligned row in the visible blocks. A
 * deletion spans reference bases `[start, start+length)`; the overlay draws the
 * bp count centered on the on-screen part when it fits. Geometry comes from the
 * shared `forEachDeletion` walk, as the hover hit test's does.
 *
 * This draws only the label (the gap cells come from the base pass), so a run
 * that cannot carry one is dropped early. The height gate matches
 * `computeVisibleLabels`, so row text reveals together.
 */
export function computeVisibleDeletions(
  params: MafOverlayParams,
): DeletionMarker[] {
  const { view, rpcDataMap, rowHeight } = params
  const markers: DeletionMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // A run's screen width is its length over `bpPerPx`, so the label test is a
  // test on length, which makes both block culls exact.
  // `regionDeletionRunBounds` covers a block wide enough to label whose runs
  // are all short.
  const minLabelBp = MIN_LABEL_WIDTH * view.bpPerPx

  if (h >= MIN_HEIGHT_FOR_TEXT) {
    for (const {
      data: regionData,
      bpToPx,
      overlaps,
      visibleStart,
      visibleEnd,
    } of eachVisibleRegion(view, rpcDataMap)) {
      const { blocks } = regionData
      const runBounds = regionDeletionRunBounds(regionData)
      // Built only once a block survives the culls, since most frames cull
      // every block.
      let rowFlank: ReturnType<typeof makeRowFlank> | undefined
      // Hoisted so the emit callback closes over this scope: it is the
      // innermost thing on a hot walk.
      let longest = 0
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        if (
          !overlaps(block.startBp, block.endBp) ||
          block.endBp - block.startBp < minLabelBp
        ) {
          continue
        }
        const bound = runBounds[i]!
        if (bound !== 0 && bound - 1 < minLabelBp) {
          continue
        }
        // Walked to full depth while measuring, so the bound survives a scroll.
        const measuring = bound === 0
        const flank = (rowFlank ??= makeRowFlank(blocks))
        longest = 0
        for (const row of block.rows) {
          const drawn = row.rowIndex >= firstRow && row.rowIndex < endRow
          if (!drawn && !measuring) {
            continue
          }
          const rowTop = offset + rowHeight * row.rowIndex
          forEachDeletion(
            block.refSeqBytes,
            row.alignmentBytes,
            block.startBp,
            flank(i, row.rowIndex),
            (start, length) => {
              if (measuring && length > longest) {
                longest = length
              }
              const lo = Math.max(start, visibleStart)
              const hi = Math.min(start + length, visibleEnd)
              if (drawn && hi > lo) {
                const { left: xLeft, width } = spanRect(bpToPx, lo, hi)
                if (width >= MIN_LABEL_WIDTH) {
                  markers.push({ xLeft, width, rowTop, h, length })
                }
              }
            },
          )
        }
        if (measuring) {
          runBounds[i] = longest + 1
        }
      }
    }
  }
  return markers
}
