import { readCategoryColor } from '../LinearAlignmentsDisplay/colorUtils.ts'

import type { SwatchCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorPalette } from './colors.ts'

// One table per overlay, saying what each slot MEANS. The colour follows from
// `readCategoryColor`, the read fills' own resolution, so an overlay slot and
// the read swatch of the same meaning cannot be two colours.
//
// **Indexing `readCategoryColor` from the linked-read pass instead —
// dropping its table — has been proposed and declined.** The colour is
// already one derivation, so it retires an index space and nothing else:
// `linkedReadColor` is in the pileup block and dropping it would reach a
// 512-byte ring slot, the saving ARCHITECTURAL_LIMITS priced and parked — "the
// slot count is the oversized term, not the slot size" — and slots 1-4 there
// ARE `PAIR_DIRECTION_NUM`, which `features/linkedReads/compute.ts` exists to
// keep true by construction.

// Slot → meaning for the read-connection band's colour types, which
// `buildArcBandFeeds` bakes into each connection's colour lane.
//
// Slot 0 is the baseline. It paints as `normalInsert` and `arcColorLegendCategory`
// names it per coloring mode: 'Normal' insert, or 'LR' orientation.
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

function resolve(categories: readonly SwatchCategory[], c: ColorPalette) {
  return categories.map(category => readCategoryColor(c, category))
}

export function buildArcColorPalette(c: ColorPalette) {
  return resolve(ARC_SLOT_CATEGORY, c)
}

export function buildLinkedReadColorPalette(c: ColorPalette) {
  return resolve(LINKED_READ_SLOT_CATEGORY, c)
}
