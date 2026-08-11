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
} from '@jbrowse/core/ui/palette'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import type { RGBColor } from './colors.ts'

// ARC_HEIGHT_MARGIN and ARC_COLOR_SHORT_INSERT used to be re-exported from
// here. Both are generated (arc.slang is the source of truth), and a generated
// constant takes no re-export hop — a consumer imports the generated module, or
// the package a `consts-out` put it in, never a third module passing it along
// (SHADER_JS_CODEGEN.md). This file was that third module for two of them.
// Palette indices match the Slang arc shaders (u.arcColor0..8). Canvas2D / SVG
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

// Read-cloud endpoint-square palette. Identical to the arc palette: the squares
// are filled opaque marks (like pileup rectangles) and the curves are thin
// strokes, and short insert used to need a different color for each — a pale
// #ffc0cb fill that vanished as a stroke, against the saturated pink the curves
// used. The fill is now that same saturated pink (see colorShortInsert), so the
// two vocabularies agree and there is nothing left to substitute.
//
// Kept as its own export rather than folded into `arcColorPalette` because the
// marker paths name it: Canvas2D, SVG and the GPU (as the `arcMarkerColor`
// uniform slots) all read this one array, and a future mark-specific color has
// one obvious place to go.
export const arcMarkerColorPalette: RGBColor[] = arcColorPalette

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
