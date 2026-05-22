import {
  LONG_INSERTION_MIN_LENGTH,
  MIN_HEIGHT_FOR_TEXT,
} from '@jbrowse/alignments-core'

import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export const FONT_CONFIG = 'bold 10px Courier New,monospace'
export const CHAR_SIZE_WIDTH = 10
// Used to overlap adjacent cells by a sub-pixel so hairlines don't appear at
// scale ~1px/bp; mirrors the +0.5/+0.4 fudge used in plugin-alignments.
export const GAP_STROKE_OFFSET = 0.4
export const INSERTION_LINE_WIDTH = 1
export const INSERTION_BORDER_WIDTH = 2
export const INSERTION_PADDING = 2
// Reuse alignments-core's "long insertion" threshold + minimum-text-row-height
// so MAF and BAM/CRAM agree on when to switch insertion glyphs / draw label
// borders. Keep MAF aliases for call-site readability.
export const LARGE_INSERTION_THRESHOLD = LONG_INSERTION_MIN_LENGTH
export const MIN_ROW_HEIGHT_FOR_BORDERS = MIN_HEIGHT_FOR_TEXT
// MAF-specific zoom thresholds; named relative to bpPerPx (canvas2d only).
export const HIGH_ZOOM_THRESHOLD = 0.2
export const HIGH_BP_PER_PX_THRESHOLD = 10
export const INSERTION_BORDER_HEIGHT = 5

export interface RenderingContext {
  ctx: Ctx2D
  scale: number
  rowHeight: number
  h: number
  palette: MafColorPalette
  showAllLetters: boolean
  mismatchRendering: boolean
  reversed: boolean
  /** bp → screen-px LEFT edge of the cell containing that bp (handles reversed). */
  bpToCellLeftPx: (bp: number) => number
}
