import { findFeatureAtBp } from '../shared/wiggleComponentUtils.ts'

import type { WiggleDataResult } from '../util.ts'

// Order rows by the score each source carries at genomic `bp` — the wiggle
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
// bp only has a score in the region it was fetched for, and the click already
// names which one. Sources with no feature covering `bp` (a gap, or a subtrack
// whose file doesn't cover this contig) sort last in their existing relative
// order; the sort is otherwise stable. NaN is treated as no score for the same
// reason — a wig file may carry one, and comparing it scrambles the order
// instead of sinking that row.
export function rowOrderByScoreAt(
  sourceNames: string[],
  data: WiggleDataResult,
  bp: number,
): string[] {
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
  return sourceNames
    .map((name, idx) => ({ name, idx, v: scoreByName.get(name) }))
    .sort((a, b) => {
      const av = a.v ?? Number.NEGATIVE_INFINITY
      const bv = b.v ?? Number.NEGATIVE_INFINITY
      return av !== bv ? bv - av : a.idx - b.idx
    })
    .map(x => x.name)
}
