import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { findFeatureAtBp } from '../shared/wiggleHitTest.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// Rows ordered by the score each source carries at genomic `bp` — the wiggle
// analogue of the multi-row feature display's "sort rows by color here" and of
// alignments' "sort by base at position". Highest first, so the clicked column
// reads top-to-bottom as a ranking: a cohort of coverage tracks sorted at a
// candidate CNV puts the carriers together at the top, and a density matrix
// sorted at a peak resolves the samples that have it.
//
// The plain `featureScores` value, which is what the tooltip prints and what
// every rendering paints its main mark from, never the min/max summary bands —
// sorting on a band nobody is reading would order the rows by a number that
// isn't on screen.
//
// One region's data, not every loaded region: the columns are pixel bins, so a
// bp only has a score in the region it was fetched for, and the caller has
// already resolved which one (`loadedRegionIndexAt`).
//
// Reading the score is the whole of what is wiggle-specific here. Sinking the
// rows with no score at `bp` — a gap, or a subtrack whose file doesn't cover
// this contig — and staying stable otherwise is `orderRowsByValueAt`'s, shared
// with the multi-row feature display's twin. NaN is dropped rather than ranked
// for the same reason a gap is: a wig file may carry one, and comparing it
// scrambles the order instead of sinking that row.
export function sortSourcesByScoreAt<T extends { name: string }>(
  sources: T[],
  data: WiggleDataResult,
  bp: number,
): T[] {
  const scoreByName = new Map<string, number>()
  for (const s of data.sources) {
    const i = findFeatureAtBp(s.featurePositions, s.numFeatures, bp)
    if (i !== -1) {
      const score = s.featureScores[i]!
      if (!Number.isNaN(score)) {
        scoreByName.set(s.name, score)
      }
    }
  }
  return orderRowsByValueAt(sources, scoreByName, (a, b) => b - a)
}
