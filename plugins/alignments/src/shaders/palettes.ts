import { swatchPaletteKeys } from '../LinearAlignmentsDisplay/colorUtils.ts'

import type { SwatchCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorPalette, RGBColor } from './colors.ts'

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
//
// **Indexing `readCategoryColor` from the linked-read pass instead —
// dropping its table — has been proposed and declined.** The colour is
// already one derivation, so it retires an index space and nothing else:
// `linkedReadColor` is in the pileup block and dropping it would reach a
// 512-byte ring slot, the saving ARCHITECTURAL_LIMITS priced and parked — "the
// slot count is the oversized term, not the slot size" — and slots 1-4 there
// ARE `PAIR_DIRECTION_NUM`, which `features/linkedReads/compute.ts` exists to
// keep true by construction.
type PaletteKey = keyof ColorPalette

// Slot → meaning for the read-connection band's colour types, which
// `buildArcBandFeeds` bakes into each connection's colour lane.
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
//   read-connection band's feeds and the linked-read overlays, which want the
//   resolved colours as an array.
// - `GpuAlignmentsRenderer`'s per-frame UBO write of the linked-read palette,
//   which walks these keys straight into the uniform buffer.
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
