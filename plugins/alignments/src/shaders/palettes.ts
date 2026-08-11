import type { ColorPalette, RGBColor } from './colors.ts'

// ARC_HEIGHT_MARGIN and ARC_COLOR_SHORT_INSERT used to be re-exported from
// here. Both are generated (arc.slang is the source of truth), and a generated
// constant takes no re-export hop — a consumer imports the generated module, or
// the package a `consts-out` put it in, never a third module passing it along
// (SHADER_JS_CODEGEN.md). This file was that third module for two of them.
// Palette indices match the Slang arc shaders (u.arcColor0..8). Canvas2D / SVG
// arc renderers reuse these same arrays, and the interchromosomal connector
// ticks (arcLine) index into this palette too. Adding a color here requires
// growing the Slang Uniforms struct and the writeUniforms() palette copy.

// EVERY overlay color is a KEY into the themed `ColorPalette`, never a baked
// RGB. The read fills have always resolved that way (`readCategoryPaletteKeys`),
// and these three did not: they were `rgb(colorPairLR)` and friends, read
// straight off the module constants, while `buildColorPaletteFromPalette` routes
// the four pair colors through `palette.alignmentFill` "so user theme overrides
// render and dark mode dims pairLR".
//
// So in dark mode the reads' LR grey was dimmed to colorPairLRDark and the arcs
// and connectors over them stayed the light #d3d3d3 the dark theme exists to
// stop drawing — the same meaning in two colors, and a user `theme` override of
// alignmentFill did the same in either mode. It survived because light mode is
// the one configuration where the two sources agree, and light mode is where
// every figure is captured.
//
// Keys, resolved per render against the palette in hand, is what makes that
// unrepresentable rather than merely fixed.
type PaletteKey = keyof ColorPalette

// Palette indices match the Slang arc shaders (u.arcColor0..8). Canvas2D / SVG
// arc renderers reuse these same slots, and the interchromosomal connector ticks
// (arcLine) index into them too. Adding a color here requires growing the Slang
// Uniforms struct and the writeUniforms() palette copy.
const ARC_PALETTE_KEYS: PaletteKey[] = [
  'colorPairLR',
  'colorLongInsert',
  'colorShortInsert',
  'colorInterchrom',
  'colorPairLL',
  'colorPairRR',
  'colorPairRL',
  'colorSplitInversion', // 7 split-read inversion — matches read fill + connector
  'colorSupplementary', // 8 split-read deletion (same-strand) — matches yellow deletion fill
]

// Read-cloud endpoint-square palette. Identical to the arc palette: the squares
// are filled opaque marks (like pileup rectangles) and the curves are thin
// strokes, and short insert used to need a different color for each — a pale
// #ffc0cb fill that vanished as a stroke, against the saturated pink the curves
// used. The fill is now that same pale pink (see colorShortInsert), so the two
// vocabularies agree and there is nothing left to substitute.
//
// Kept as its own name rather than folded into the arc keys because the marker
// paths name it: Canvas2D, SVG and the GPU (as the `arcMarkerColor` uniform
// slots) all read this one table, and a future mark-specific color has one
// obvious place to go.
const ARC_MARKER_PALETTE_KEYS: PaletteKey[] = ARC_PALETTE_KEYS

// Indices match LINKED_READ_COLOR_* in features/linkedReads/compute.ts. Used by
// the GPU palette UBO, the Canvas2D draw, and the SVG export so the three paths
// stay in lockstep.
const LINKED_READ_PALETTE_KEYS: PaletteKey[] = [
  'colorPairLR', // 0 unknown
  'colorPairLR', // 1 LR
  'colorPairRL', // 2 RL
  'colorPairRR', // 3 RR
  'colorPairLL', // 4 LL
  'colorSupplementary', // 5 split deletion (same-strand) — matches the yellow deletion read fill
  'colorSplitInversion', // 6 split inversion — matches the read-fill split-inversion color so a magenta segment and its connector agree
  'colorPairLR', // 7 fallback
]

function resolve(keys: PaletteKey[], c: ColorPalette): RGBColor[] {
  return keys.map(k => c[k])
}

export function buildArcColorPalette(c: ColorPalette) {
  return resolve(ARC_PALETTE_KEYS, c)
}

export function buildArcMarkerColorPalette(c: ColorPalette) {
  return resolve(ARC_MARKER_PALETTE_KEYS, c)
}

export function buildLinkedReadColorPalette(c: ColorPalette) {
  return resolve(LINKED_READ_PALETTE_KEYS, c)
}
