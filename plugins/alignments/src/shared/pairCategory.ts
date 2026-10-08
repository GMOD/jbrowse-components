import { classifyInsertSize } from './insertSizeStats.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ArcColorField } from './arcColorOptions.ts'
import type { InsertSizeBand } from './insertSizeStats.ts'

/**
 * The one classification of a pair under the three pair color fields, read
 * by the read fill (`schemeCategory`) and the read-connection arcs
 * (`getArcColorType`) alike, so an arc and the reads under it cannot key the
 * same pair two different ways. Both sides hand it the pair's orientation
 * (`pairOrientationToNum`: 1 LR, 2 RL, 3 RR, 4 LL, 0 none) and its TLEN with
 * the region's insert-size band.
 */
export function pairCategory(
  field: ArcColorField,
  pairOrientationNum: number,
  tlen: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  switch (field) {
    case 'insertSize':
      return insertSizeCategory(tlen, stats)
    case 'pairOrientation':
      return pairOrientationCategory(pairOrientationNum)
    // a short insert paints pink whatever the orientation; otherwise an
    // abnormal orientation wins, and an LR pair falls back to its insert class
    case 'insertSizeAndOrientation': {
      const insert = insertSizeCategory(tlen, stats)
      return insert === 'shortInsert'
        ? insert
        : (ABNORMAL_ORIENTATION[pairOrientationNum] ?? insert)
    }
  }
}

const ORIENTATION: Record<number, ReadColorCategory> = {
  1: 'pairLR',
  2: 'pairRL',
  3: 'pairRR',
  4: 'pairLL',
}

const ABNORMAL_ORIENTATION: Record<number, ReadColorCategory> = {
  2: 'pairRL',
  3: 'pairRR',
  4: 'pairLL',
}

// 0 means no computed pair orientation: a non-split read with no mate to
// orient against, grey rather than a strand or orientation color.
export function pairOrientationCategory(
  pairOrientationNum: number,
): ReadColorCategory {
  return ORIENTATION[pairOrientationNum] ?? 'nonSplit'
}

const INSERT_CLASS: Record<
  ReturnType<typeof classifyInsertSize>,
  ReadColorCategory
> = {
  long: 'longInsert',
  short: 'shortInsert',
  normal: 'normalInsert',
}

export function insertSizeCategory(
  tlen: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  return INSERT_CLASS[classifyInsertSize(Math.abs(tlen), stats)]
}
