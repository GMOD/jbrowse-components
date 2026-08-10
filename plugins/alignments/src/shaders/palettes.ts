import {
  colorInterchrom,
  colorLongInsert,
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorShortInsert,
  colorShortInsertArc,
  colorSplitReadInversion,
  colorSupplementary,
} from '@jbrowse/core/ui/palette'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import { ARC_COLOR_SHORT_INSERT } from './slang/arc.iface.generated.ts'

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

// Read-cloud endpoint-square palette. The squares are filled opaque
// marks (like pileup rectangles), so short-insert uses the pale pileup-fill
// color (colorShortInsert #ffc0cb) to match the legend + pileup, not the
// saturated stroke variant (colorShortInsertArc #ff3a8c) the arc *curves* use so
// a thin translucent line stays visible. Every other slot is the arc palette.
//
// All three marker paths read this one array: Canvas2D, SVG, and the GPU, which
// gets it as the `arcMarkerColor` uniform slots. The shader used to re-do the
// substitution itself, in a branch on ARC_COLOR_SHORT_INSERT that read a packed
// uint while its other arm indexed a float4 palette, and this comment used to
// say it mirrored that branch. A comment claiming two things agree is the thing
// worth deleting, not the duplication it was apologizing for.
export const arcMarkerColorPalette: RGBColor[] = arcColorPalette.map((c, i) =>
  i === ARC_COLOR_SHORT_INSERT ? rgb(colorShortInsert) : c,
)

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
