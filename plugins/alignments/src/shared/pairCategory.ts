import { classifyInsertSize } from './insertSizeStats.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { InsertSizeBand } from './insertSizeStats.ts'

/**
 * The one classification of a pair, read by the read fill (`fillCategory`)
 * and the read connections (`getArcColorType`) alike, so a connection and the
 * reads under it cannot key the same pair two different ways. Both sides hand
 * it the pair's orientation (`pairOrientationToNum`: 1 LR, 2 RL, 3 RR, 4 LL,
 * 0 none) and its TLEN with the region's insert-size band. An abnormal
 * orientation wins, as SV channels files the pair by it
 * (`discordantPairKind`), and an LR pair, or one with no orientation, takes
 * its insert class. LR is the normal orientation, as an `fr` library has it; a
 * library of another orientation would want that as an input here, not a
 * second field.
 *
 * A short insert ranked first, as insertion evidence, until the SV channels
 * inversion band showed what that cost: no insertion puts a pair's mates on
 * one strand, and an RR pair at an inversion breakpoint, its mates a few bases
 * apart, painted pink there or purple by whichever pairs the view had loaded.
 */
export function pairCategory(
  pairOrientationNum: number,
  tlen: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  return (
    ABNORMAL_ORIENTATION[pairOrientationNum] ??
    INSERT_CLASS[classifyInsertSize(Math.abs(tlen), stats)]
  )
}

export const ABNORMAL_ORIENTATION: Record<number, ReadColorCategory> = {
  2: 'pairRL',
  3: 'pairRR',
  4: 'pairLL',
}

export const INSERT_CLASS: Record<
  ReturnType<typeof classifyInsertSize>,
  ReadColorCategory
> = {
  long: 'longInsert',
  short: 'shortInsert',
  normal: 'normalInsert',
}
