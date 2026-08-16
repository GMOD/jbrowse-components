import { measureText } from '@jbrowse/core/util'

import type { MafCellColorConfig } from '../resolveCellColor.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const LABEL_FONT_SIZE = 10
export const FONT_CONFIG = `bold ${LABEL_FONT_SIZE}px Courier New,monospace`
export const CHAR_SIZE_WIDTH = 10

// FONT_CONFIG's own width, for the callers that reserve room before drawing in
// it. `measureText` measures against a Helvetica table unless told the family is
// monospace, and this font IS monospace — so measuring it plain under-read every
// digit by 0.55px, which the deletion count's 2px of padding covered up to three
// digits and not beyond: a 1000bp+ run cleared a fit test its label then
// overflowed. Bold costs nothing here, monospace being the one face whose bold
// advance equals its regular.
export function measureLabelText(text: string) {
  return measureText(text, LABEL_FONT_SIZE, 'monospace')
}
// Used to overlap adjacent cells by a sub-pixel so hairlines don't appear at
// scale ~1px/bp; mirrors the +0.5/+0.4 fudge used in plugin-alignments.
export const GAP_STROKE_OFFSET = 0.4

/**
 * The per-block base-cell draw context. Insertions and deletions are NOT drawn
 * from here — they render from positioned markers (`computeVisibleInsertions` /
 * `computeVisibleDeletions`) so the on-screen overlays and SVG export share one
 * path, exactly like the other MAF overlays. `drawMafBlocks` therefore paints
 * only base cells, matching the GPU shader's output.
 */
export interface RenderingContext {
  ctx: Ctx2D
  h: number
  /** Pre-built once per draw call; consumed by `resolveCellColor` per cell. */
  cellColorConfig: MafCellColorConfig
  /**
   * Raw bp → screen-px. Cells are filled via `fillBpSpan`, which maps both
   * edges — so no painter here needs the one-base pivot of
   * `makeCellLeftMapper`, and none can get it backwards on a reversed block.
   */
  bpToPx: (bp: number) => number
  /**
   * Genomic bp per painted cell — `1` per base, larger once cells go sub-pixel.
   * Must be the same value the GPU encoder used (both read the display's
   * `encodeBinBp`) or the two backends diverge at zoom-out.
   */
  binBp: number
}
