import { isBreakend } from '../VcfFeature/util.ts'

import type { Feature } from '@jbrowse/core/util'

// Longest allele a record describes, in bp: the reference span, or an ALT
// sequence longer than it. `end - start` alone answers "how much reference does
// this consume", which is 1 for every insertion however large — so a length
// filter written on the span silently keeps SNPs and drops the insertions,
// exactly the half of a pangenome callset an SV view is about. Symbolic ALTs
// (`<INS>` and friends) carry no sequence to measure and are already resolved
// into the feature's span by `getEnd`, so they fall through to it.
//
// Breakend ALTs are excluded for the same reason and are NOT covered by the
// `<` test: `G]chr17:198982]` is mate notation, not 15 bp of sequence, so
// measuring it reported a 14 bp insertion on every BND record — a phantom
// "Insertion: 14bp" tooltip row, a cell widened toward an insertion marker, and
// a `jexl:alleleLength(feature) >= 50` filter selecting on the length of a
// contig name. `isBreakend` is the same predicate `svTypeFromAlt` and `getSOTerm`
// use, so a breakend cannot be one thing to the SO term and another here.
export function getAlleleLength(feature: Feature) {
  const span = feature.get('end') - feature.get('start')
  const alt = feature.get('ALT') as string[] | undefined
  let longest = span
  for (const a of alt ?? []) {
    if (!a.startsWith('<') && !isBreakend(a) && a.length > longest) {
      longest = a.length
    }
  }
  return longest
}

// Bases the record inserts, i.e. the sequence its longest ALT carries beyond the
// reference it replaces. Zero for a SNP or a deletion, whose length the cell's
// own reference width already draws. This is the number the insertion marker
// sizes and labels itself with, and the "Insertion" tooltip row reports, so both
// displays read it from here.
export function getInsertedBp(feature: Feature) {
  return Math.max(
    0,
    getAlleleLength(feature) - (feature.get('end') - feature.get('start')),
  )
}
