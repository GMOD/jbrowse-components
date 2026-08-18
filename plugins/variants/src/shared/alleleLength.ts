import { isBreakend, parseFiniteNumber } from '../VcfFeature/util.ts'

import type { Feature } from '@jbrowse/core/util'

// Bases a symbolic `<INS>` (or `<INS:ME:ALU>`, …) declares, from the SVLEN
// entry paired with that ALT. This is the one symbolic class `getEnd` does NOT
// resolve into the feature's span: an insertion consumes no reference, so it
// deliberately spans 1 bp there and the sequence is stated only in INFO. Every
// other symbolic class (`<DEL>`, `<DUP>`, `<INV>`) already spans what it
// describes, which is why the loop below reads SVLEN for this one alone.
function symbolicInsertionBp(feature: Feature, altIndex: number) {
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const svlen = Array.isArray(info?.SVLEN) ? info.SVLEN : undefined
  const len = parseFiniteNumber(svlen?.[altIndex])
  return len === undefined ? 0 : Math.abs(len)
}

// Longest allele a record describes, in bp: the reference span, or an ALT
// sequence longer than it. `end - start` alone answers "how much reference does
// this consume", which is 1 for every insertion however large — so a length
// filter written on the span silently keeps SNPs and drops the insertions,
// exactly the half of a pangenome callset an SV view is about. A symbolic ALT
// carries no sequence to measure: `<DEL>`, `<DUP>` and `<INV>` are already
// resolved into the feature's span by `getEnd` and fall through to it, and
// `<INS>` reads the bases it declares out of SVLEN (see below).
//
// Breakend ALTs are excluded for the same reason and are NOT covered by the
// `<` test: `G]chr17:198982]` is mate notation, not 15 bp of sequence, so
// measuring it reported a 14 bp insertion on every BND record — a phantom
// "Insertion: 14bp" tooltip row, a cell widened toward an insertion marker, and
// a `jexl:alleleLength(feature) >= 50` filter selecting on the length of a
// contig name. `isBreakend` is the same predicate `svTypeFromAlt` and `getSOTerm`
// use, so a breakend cannot be one thing to the SO term and another here.
//
// The exception among symbolic ALTs is `<INS>`, whose span `getEnd` pins at
// 1 bp precisely because an insertion consumes no reference. Falling through to
// that span called every symbolic insertion 1 bp long, so a manta/delly/pbsv
// callset — where `<INS>` + `SVLEN` is the ordinary spelling — got no insertion
// marker, no "Insertion" tooltip row, and was dropped by the same
// `alleleLength(feature) >= 50` filter this function exists to make work. Adding
// SVLEN to the span is what the explicit-sequence form already measures: REF
// plus the inserted bases.
export function getAlleleLength(feature: Feature) {
  const span = feature.get('end') - feature.get('start')
  const alt = feature.get('ALT') as string[] | undefined
  let longest = span
  let i = 0
  for (const a of alt ?? []) {
    const len = a.startsWith('<INS')
      ? span + symbolicInsertionBp(feature, i)
      : a.startsWith('<') || isBreakend(a)
        ? 0
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
