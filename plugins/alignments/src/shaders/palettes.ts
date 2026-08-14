import { swatchPaletteKeys } from '../LinearAlignmentsDisplay/colorUtils.ts'

import type { SwatchCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
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

// ONE TABLE PER OVERLAY, and it says what each slot MEANS, not what colour it
// is. The colour follows from `swatchPaletteKeys` — the read fills' own table —
// so an overlay slot and the read swatch of the same meaning cannot be two
// colours. They were, twice over: first because these were baked from module
// constants while the read fills resolved through the theme (so dark mode dimmed
// the reads and not the arcs over them), and before that because "matches the
// read fill" was a comment rather than a derivation.
//
// A parity test can only catch that after someone writes it. Deriving is what
// makes it unrepresentable, and it is the shape `readCategoryPaletteKeys`
// already uses for the reads themselves.
type PaletteKey = keyof ColorPalette

// Slot → meaning for the Slang arc shaders (u.arcColor0..8), which the Canvas2D
// and SVG arc renderers and the interchromosomal connector ticks (arcLine) index
// into as well. Adding a slot here requires growing the Slang Uniforms struct
// and the writeUniforms() palette copy.
//
// Slot 0 is the baseline, whose LABEL depends on the coloring mode ('Normal'
// insert vs. 'LR' orientation) though both resolve to the same swatch — see
// `arcColorLegendCategory`, which reads this table.
export const ARC_SLOT_CATEGORY = [
  'normalInsert',
  'longInsert',
  'shortInsert',
  'interchrom',
  'pairLL',
  'pairRR',
  'pairRL',
  'splitInversion',
  'splitDeletion',
] as const satisfies readonly SwatchCategory[]

// Slot → meaning for the linked-read connectors, matching LINKED_READ_COLOR_* in
// features/linkedReads/compute.ts. Slot 0 is the unknown baseline: it takes the
// same swatch as LR but is not labelled as LR (see `connectionLabel`).
//
// Slot 7 was a second copy of that fallback and unreachable — neither
// `pairedColorType` nor `splitColorType` could emit it — so giving it to
// `interchrom` costs no uniform space: the array is still eight entries and
// `LINKED_READ_COLOR_SLOTS` in alignmentsUniforms.slang does not move.
export const LINKED_READ_SLOT_CATEGORY = [
  'pairLR',
  'pairLR',
  'pairRL',
  'pairRR',
  'pairLL',
  'splitDeletion',
  'splitInversion',
  'interchrom',
] as const satisfies readonly SwatchCategory[]

// Slot → palette KEY, resolved through `swatchPaletteKeys` once at module load.
// Both readers take these arrays, so the derivation still happens in exactly one
// place — which is the whole point of the tables above:
//
// - `buildArcColorPalette` / `buildLinkedReadColorPalette` below, for the
//   Canvas2D and SVG arc renderers and the linked-read overlays, which want the
//   resolved colours as an array.
// - `GpuAlignmentsRenderer`'s per-frame UBO write, which walks these keys
//   straight into the uniform buffer rather than building an array it discards.
//   That writer runs once per region, per track, per frame.
const ARC_SLOT_KEYS: readonly PaletteKey[] = ARC_SLOT_CATEGORY.map(
  category => swatchPaletteKeys[category] as PaletteKey,
)
const LINKED_READ_SLOT_KEYS: readonly PaletteKey[] =
  LINKED_READ_SLOT_CATEGORY.map(
    category => swatchPaletteKeys[category] as PaletteKey,
  )

export { ARC_SLOT_KEYS, LINKED_READ_SLOT_KEYS }

function resolve(keys: readonly PaletteKey[], c: ColorPalette): RGBColor[] {
  return keys.map(key => c[key])
}

export function buildArcColorPalette(c: ColorPalette) {
  return resolve(ARC_SLOT_KEYS, c)
}

export function buildLinkedReadColorPalette(c: ColorPalette) {
  return resolve(LINKED_READ_SLOT_KEYS, c)
}
