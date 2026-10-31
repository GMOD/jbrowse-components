import { classifyInsertSize } from './insertSizeStats.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { InsertSizeBand } from './insertSizeStats.ts'

/**
 * The one classification of a pair, read by the read fill (`fillCategory`)
 * and the read connections (`getArcColorType`) alike, so a connection and the
 * reads under it cannot key the same pair two different ways. Both sides hand
 * it the pair's orientation (`pairOrientationToNum`: 1 LR, 2 RL, 3 RR, 4 LL,
 * 0 none) and its TLEN with the region's insert-size band. A short insert
 * paints pink whatever the orientation; otherwise an abnormal orientation
 * wins, and an LR pair, or one with no orientation, takes its insert class.
 * LR is the normal orientation, as an `fr` library has it; a library of
 * another orientation would want that as an input here, not a second field.
 */
export function pairCategory(
  pairOrientationNum: number,
  tlen: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  const insert = insertSizeCategory(tlen, stats)
  return insert === 'shortInsert'
    ? insert
    : (ABNORMAL_ORIENTATION[pairOrientationNum] ?? insert)
}

const ABNORMAL_ORIENTATION: Record<number, ReadColorCategory> = {
  2: 'pairRL',
  3: 'pairRR',
  4: 'pairLL',
}

const INSERT_CLASS: Record<
  ReturnType<typeof classifyInsertSize>,
  ReadColorCategory
> = {
  long: 'longInsert',
  short: 'shortInsert',
  normal: 'normalInsert',
}

function insertSizeCategory(
  tlen: number,
  stats: InsertSizeBand | undefined,
): ReadColorCategory {
  return INSERT_CLASS[classifyInsertSize(Math.abs(tlen), stats)]
}
