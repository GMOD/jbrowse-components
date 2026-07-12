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
  scale: number
  h: number
  /** Pre-built once per draw call; consumed by `resolveCellColor` per cell. */
  cellColorConfig: MafCellColorConfig
  /** bp → screen-px LEFT edge of the cell containing that bp (handles reversed). */
  bpToCellLeftPx: (bp: number) => number
}
