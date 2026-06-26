import type { MafCellColorConfig } from '../resolveCellColor.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export const FONT_CONFIG = 'bold 10px Courier New,monospace'
export const CHAR_SIZE_WIDTH = 10
// Used to overlap adjacent cells by a sub-pixel so hairlines don't appear at
// scale ~1px/bp; mirrors the +0.5/+0.4 fudge used in plugin-alignments.
export const GAP_STROKE_OFFSET = 0.4

export interface RenderingContext {
  ctx: Ctx2D
  scale: number
  h: number
  palette: MafColorPalette
  /** Pre-built once per draw call; consumed by `resolveCellColor` per cell. */
  cellColorConfig: MafCellColorConfig
  reversed: boolean
  /** bp → screen-px LEFT edge of the cell containing that bp (handles reversed). */
  bpToCellLeftPx: (bp: number) => number
}
