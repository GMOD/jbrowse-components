import type { MafCellColorConfig } from '../resolveCellColor.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export const FONT_CONFIG = 'bold 10px Courier New,monospace'
export const CHAR_SIZE_WIDTH = 10
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
