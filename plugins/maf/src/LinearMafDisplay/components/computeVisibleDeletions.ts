import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'

import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'
import { makeRowFlank } from '../../LinearMafRenderer/rendering/rowFlank.ts'
import { LABEL_FONT } from '../../LinearMafRenderer/rendering/types.ts'
import { regionDeletionRunBounds } from './mafRowEvents.ts'
import {
  bpSpanPx,
  eachVisibleRegion,
  rowViewport,
} from './visibleRegionGeometry.ts'

import type { MafOverlayParams } from './visibleRegionGeometry.ts'

// Narrowest label `drawMafDeletionLabels` could ever fit: one digit in its own
// font, plus its 2px padding. A run below this can't draw at any digit count — a
// longer run is proportionally wider, so width outruns the label long before the
// digit count does. One digit answers for all ten because the font is monospace;
// this used to take a `Math.min` over the ten, which the proportional table it
// was measuring against made look necessary and returned the same width anyway.
//
// This is a hard cut, where plugin-alignments ramps the same label's opacity
// across the band above its own threshold (`labelFadeOpacity`). The two displays
// share the zoom a label appears AT — MIN_HEIGHT_FOR_TEXT and
// MIN_PX_PER_BP_FOR_TEXT are imported for exactly that — and differ on how it
// arrives. Taking the ramp here is a live proposal rather than an oversight: one
// MAF deletion is a single event at one length across many species rows, so
// these labels genuinely do cross the threshold together, which is the flicker a
// ramp is for. Undecided because nobody has watched a MAF track zoom to say
// whether a fading number in a short row beats a clean cut, and adopting it
// moves every MAF figure carrying a count.
const MIN_LABEL_WIDTH = LABEL_FONT.measure('0') + 2

export interface DeletionMarker {
  /** screen px of the left edge of the deleted run */
  xLeft: number
  /** screen px width of the deleted run */
  width: number
  rowTop: number
  h: number
  /** number of deleted reference bases */
  length: number
}

/**
 * Positioned deletion runs for every aligned row in the visible blocks. A
 * deletion spans reference bases `[start, start+length)`, so the marker spans
 * those cells; the overlay draws the bp count centered when it fits. Geometry
 * comes from the shared `forEachDeletion` walk, the same source the hover
 * hit-test uses.
 *
 * Unlike the insertion overlay this draws *nothing but* the label — the gap
 * cells come from the base pass — so a run that cannot carry one is dead work,
 * and the gates below drop it as early as they can. Zoomed out on a
 * multi-species alignment that was 679k markers built and 0 drawn per frame. The
 * height gate is the one `computeVisibleLabels` applies, so all row text still
 * reveals together.
 */
export function computeVisibleDeletions(
  params: MafOverlayParams,
): DeletionMarker[] {
  const { view, rpcDataMap, rowHeight } = params
  const markers: DeletionMarker[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)
  // A run's screen width is its length over `bpPerPx`, so the label test is a
  // test on LENGTH — which makes both block culls below exact rather than
  // heuristic. The block's own reference span bounds every run in it, answering
  // the many-small-blocks shapes (ce11 26-way's median block is 7bp) for free;
  // `regionDeletionRunBounds` covers what that cannot, a block wide enough to
  // label whose runs are all short — a 200bp block of 2bp runs at 13bp/px.
  const minLabelBp = MIN_LABEL_WIDTH * view.bpPerPx

  if (h >= MIN_HEIGHT_FOR_TEXT) {
    for (const { data: regionData, bpToPx, bpLo, bpHi } of eachVisibleRegion(
      view,
      rpcDataMap,
    )) {
      const { blocks } = regionData
      const runBounds = regionDeletionRunBounds(regionData)
      // Built only once a block survives the culls: it is an array as long as
      // the region's blocks, and with the bounds in place most frames cull
      // every one of them and want no flank at all.
      let rowFlank: ReturnType<typeof makeRowFlank> | undefined
      // Hoisted so the emit callback closes over this scope rather than a
      // per-block one: it is the innermost thing on a hot walk.
      let longest = 0
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        if (
          block.endBp <= bpLo ||
          block.startBp >= bpHi ||
          block.endBp - block.startBp < minLabelBp
        ) {
          continue
        }
        const bound = runBounds[i]!
        if (bound !== 0 && bound - 1 < minLabelBp) {
          continue
        }
        // Walked to its full depth while measuring, so the bound survives a
        // scroll; only where it draws once it has one.
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
              if (drawn) {
                const { xLeft, width } = bpSpanPx(bpToPx, start, start + length)
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
