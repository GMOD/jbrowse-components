import { isBreakend } from '@jbrowse/core/util/svAlt'

import { parseFiniteNumber } from '../VcfFeature/util.ts'

import type { Feature } from '@jbrowse/core/util'

// The bases an insertion ALT states in its SVLEN, paired by ALT index.
function statedInsertionBp(
  info: Record<string, unknown> | undefined,
  altIndex: number,
) {
  const svlen = Array.isArray(info?.SVLEN) ? info.SVLEN : undefined
  const len = parseFiniteNumber(svlen?.[altIndex])
  return len ? Math.abs(len) : undefined
}

// Longest allele a record describes, in bp: the reference span, or an ALT
// longer than it. `end - start` alone is 1 for every insertion however large,
// so a length filter written on the span keeps SNPs and drops the insertions.
//
// An insertion's own SVLEN wins wherever the record states it, over the ALT
// string as much as over the span: it is the caller's answer, and a caller's
// sequence can run a base past it. Without one, a sequence ALT measures
// itself, the padding base REF shares included.
//
// `<DEL>`, `<DUP>` and `<INV>` are resolved into the span by `getEnd` and fall
// through to it. `<INS>` consumes no reference, so `getEnd` pins it at 1 bp and
// only SVLEN says how long it is. Breakend ALTs are mate notation rather than
// sequence (`G]chr17:198982]` is not 15 bp), and `isBreakend` is the predicate
// `svClassOfAlt` and `getSOTerm` use.
export function getAlleleLength(feature: Feature) {
  const span = feature.get('end') - feature.get('start')
  const alt = feature.get('ALT') as string[] | undefined
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  let longest = span
  let i = 0
  for (const a of alt ?? []) {
    const len = a.startsWith('<INS')
      ? span + (statedInsertionBp(info, i) ?? 0)
      : a.startsWith('<') || isBreakend(a)
        ? 0
        : a.length > span
          ? span + (statedInsertionBp(info, i) ?? a.length - span)
          : a.length
    if (len > longest) {
      longest = len
    }
    i++
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
