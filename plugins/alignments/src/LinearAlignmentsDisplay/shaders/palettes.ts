import {
  colorInterchrom,
  colorLongInsert,
  colorLongreadRevFwd,
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorShortInsert,
} from '@jbrowse/core/ui/theme'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import type { RGBColor } from './colors.ts'

// Palette indices match the Slang arc shaders (u.arcColor0..7). Canvas2D / SVG
// arc renderers reuse these same arrays, and the interchromosomal connector
// ticks (arcLine) index into this palette too. Adding a color here requires
// growing the Slang Uniforms struct and the writeUniforms() palette copy.
// Pixels of padding above the arc apex (must match arc.slang).
export const ARC_HEIGHT_MARGIN = 8

const rgb = cssColorToNormalizedRgb

export const arcColorPalette: RGBColor[] = [
  rgb(colorPairLR),
  rgb(colorLongInsert),
  rgb(colorShortInsert),
  rgb(colorInterchrom),
  rgb(colorPairLL),
  rgb(colorPairRR),
  rgb(colorPairRL),
  rgb(colorLongreadRevFwd),
]

// Indices match LINKED_READ_COLOR_* in features/linkedReads/compute.ts. Used by the
// GPU palette UBO, the Canvas2D draw, and the SVG export so the three paths
// stay in lockstep.
export const linkedReadColorPalette: RGBColor[] = [
  rgb(colorPairLR), // 0 unknown
  rgb(colorPairLR), // 1 LR
  rgb(colorPairRL), // 2 RL
  rgb(colorPairRR), // 3 RR
  rgb(colorPairLL), // 4 LL
  rgb(colorPairLR), // 5 split normal (same-strand deletion)
  rgb(colorPairRR), // 6 split inversion (different-strand, matches paired RR)
  rgb(colorPairLR), // 7 fallback
]
