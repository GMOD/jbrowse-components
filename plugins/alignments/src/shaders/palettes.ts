import {
  ARC_SPLIT_PAIR_TWIN,
  isArcSplitCategory,
} from '../features/arcs/arcSplitCategory.ts'

import type {
  ReadColorCategory,
  SwatchCategory,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { ArcColorField } from '../shared/types.ts'
import type { ColorPalette } from './colors.ts'

// One table per overlay, saying what each slot MEANS. The color follows from
// the palette's `readCategoryColors`, the read fills' own table, so an overlay
// slot and the read swatch of the same meaning cannot be two colors.
//
// **Indexing `readCategoryColor` from the linked-read pass instead —
// dropping its table — has been proposed and declined.** The color is
// already one derivation, so it retires an index space and nothing else:
// `linkedReadColor` is in the pileup block and dropping it would reach a
// 512-byte ring slot, the saving ARCHITECTURAL_LIMITS priced and parked — "the
// slot count is the oversized term, not the slot size" — and slots 1-4 there
// ARE `PAIR_DIRECTION_NUM`, which `features/linkedReads/compute.ts` exists to
// keep true by construction.

// What an arc slot can mean: a read category, or a split-junction class that
// only an arc carries.
export type ArcCategory = ReadColorCategory | ArcSplitCategory

// Slot → meaning for the read-connection band's color types, which
// `buildArcBandFeeds` bakes into each connection's color lane.
//
// Slot 0 is the baseline, which `arcSlotCategory` reads per coloring mode.
export const ARC_SLOT_CATEGORY = [
  'normalInsert',
  'longInsert',
  'shortInsert',
  'interchrom',
  'pairLL',
  'pairRR',
  'pairRL',
  'splitForward',
  'splitBack',
  'splitInvLL',
  'splitInvRR',
] as const satisfies readonly (SwatchCategory | ArcSplitCategory)[]

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

/**
 * What an arc or read-cloud color slot means. The baseline slot, and any slot
 * past the table, is the normal insert or, coloring by pair orientation, the
 * LR pair, so its label and its declared color follow the mode; every other
 * slot means the same thing whatever the mode. The band's palette, its key and
 * its tooltip all read this.
 */
export function arcSlotCategory(
  slot: number,
  colorField: ArcColorField,
): SwatchCategory | ArcSplitCategory {
  const category = ARC_SLOT_CATEGORY[slot]
  return category === undefined || category === 'normalInsert'
    ? colorField === 'pairOrientation'
      ? 'pairLR'
      : 'normalInsert'
    : category
}

/**
 * The color an arc category paints. A deletion-type split keeps the split-read
 * gold of the read fills, so gold over the red of long-insert pairs shows both
 * kinds of evidence at a deletion. The other three take their pair twin's
 * color, declared colors included: nothing else tells a duplication-type
 * junction from a deletion-type one, or the two ends of an inversion apart.
 */
export function arcCategoryColor(c: ColorPalette, category: ArcCategory) {
  return c.readCategoryColors[
    isArcSplitCategory(category)
      ? category === 'splitForward'
        ? 'splitDeletion'
        : ARC_SPLIT_PAIR_TWIN[category]
      : category
  ]
}

export function buildArcColorPalette(
  c: ColorPalette,
  colorField: ArcColorField,
) {
  return ARC_SLOT_CATEGORY.map((_, slot) =>
    arcCategoryColor(c, arcSlotCategory(slot, colorField)),
  )
}

export function buildLinkedReadColorPalette(c: ColorPalette) {
  return LINKED_READ_SLOT_CATEGORY.map(
    category => c.readCategoryColors[category],
  )
}
