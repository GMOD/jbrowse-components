import {
  ARC_SPLIT_SWATCH,
  isArcSplitCategory,
} from '../features/arcs/arcSplitCategory.ts'

import type { SwatchCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { ColorPalette } from './colors.ts'

// The table saying what each slot of the read connections MEANS, for the arcs,
// the read cloud and the connectors over the pileup alike. The color follows
// from the palette's `readCategoryColors`, the read fills' own table, so a
// connection slot and the read swatch of the same meaning cannot be two colors.

// What an arc slot can mean: a read category with a swatch, or a
// split-junction class that only a connection carries.
export type ArcCategory = SwatchCategory | ArcSplitCategory

// Slot → meaning for the read-connection band's color types, which
// `buildArcBandFeeds` bakes into each connection's color lane.
//
// Slot 0 is the baseline, the normal insert.
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
 * What a connection color slot means, a slot past the table the normal
 * insert. The band's palette, its key and its tooltip all read this.
 */
export function arcSlotCategory(
  slot: number,
): SwatchCategory | ArcSplitCategory {
  return ARC_SLOT_CATEGORY[slot] ?? 'normalInsert'
}

/**
 * The color an arc category paints: a split class its swatch's
 * (`ARC_SPLIT_SWATCH`), declared colors included, and any other category its
 * own.
 */
export function arcCategoryColor(
  c: Pick<ColorPalette, 'readCategoryColors'>,
  category: ArcCategory,
) {
  return c.readCategoryColors[
    isArcSplitCategory(category) ? ARC_SPLIT_SWATCH[category] : category
  ]
}

export function buildArcColorPalette(c: ColorPalette) {
  return ARC_SLOT_CATEGORY.map(category => arcCategoryColor(c, category))
}
