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

// The table saying what each slot of the read connections MEANS, for the arcs,
// the read cloud and the connectors over the pileup alike. The color follows
// from the palette's `readCategoryColors`, the read fills' own table, so a
// connection slot and the read swatch of the same meaning cannot be two colors.

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
export function arcCategoryColor(
  c: Pick<ColorPalette, 'readCategoryColors'>,
  category: ArcCategory,
) {
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
