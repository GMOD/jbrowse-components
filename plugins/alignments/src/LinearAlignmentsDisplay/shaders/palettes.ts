import {
  colorInterchrom,
  colorLongInsert,
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorShortInsertArc,
  colorSplitReadInversion,
  colorSupplementary,
} from '@jbrowse/core/ui/theme'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import type { RGBColor } from './colors.ts'

// Pixels of padding above the arc apex. Re-exported from arc.generated.ts
// (arc.slang is the source of truth) so the shader and the Canvas2D / SVG arc
// renderers share one value.
export { ARC_HEIGHT_MARGIN } from './slang/arc.iface.generated.ts'

// Palette indices match the Slang arc shaders (u.arcColor0..7). Canvas2D / SVG
// arc renderers reuse these same arrays, and the interchromosomal connector
// ticks (arcLine) index into this palette too. Adding a color here requires
// growing the Slang Uniforms struct and the writeUniforms() palette copy.

const rgb = cssColorToNormalizedRgb

export const arcColorPalette: RGBColor[] = [
  rgb(colorPairLR),
  rgb(colorLongInsert),
  rgb(colorShortInsertArc),
  rgb(colorInterchrom),
  rgb(colorPairLL),
  rgb(colorPairRR),
  rgb(colorPairRL),
  rgb(colorSplitReadInversion), // 7 split-read inversion — matches read fill + connector
  rgb(colorSupplementary), // 8 split-read deletion (same-strand) — matches yellow deletion fill
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
  rgb(colorSupplementary), // 5 split deletion (same-strand) — matches the yellow deletion read fill
  rgb(colorSplitReadInversion), // 6 split inversion — matches the read-fill split-inversion color so a magenta segment and its connector agree
  rgb(colorPairLR), // 7 fallback
]
