import type { CandidateKind, CandidateSort } from './types.ts'

// Which pileup column a VCF record names, in the conventions of the alignments
// sort (`buildSortKeyMap` in plugins/alignments/src/RenderAlignmentDataRPC/
// sortLayout.ts), which is where an off-by-one here would show:
//
// - `basePair` keys a read on its mismatch base at `pos`, or on `*` when a
//   deletion gap covers it (`gapStart <= pos < gapEnd`), so a deletion sorts
//   on its first DELETED base, not its anchor.
// - `insertion` keys a read on an insertion recorded at exactly `pos`, and the
//   CIGAR walk records one at the reference base that FOLLOWS it
//   (`emitInsertion`: `featureStart + start`, the ref offset after the anchor).
//
// `sortCoordinate.test.ts` pins the table and the alignments plugin's
// `variantReviewSortContract.test.ts` pins it against the real sort.

interface AlleleClass {
  kind: CandidateKind
  sort?: CandidateSort
}

function isSymbolic(alt: string) {
  return alt.startsWith('<')
}

// `G]17:198982]`, `[13:123456[T`, and the single breakends `.A` / `A.`
function isBreakend(alt: string) {
  return (
    alt.includes('[') ||
    alt.includes(']') ||
    (alt.length > 1 && (alt.startsWith('.') || alt.endsWith('.')))
  )
}

function commonPrefixLength(a: string, b: string) {
  const n = Math.min(a.length, b.length)
  let k = 0
  while (k < n && a[k] === b[k]) {
    k++
  }
  return k
}

/**
 * One REF/ALT pair. Alleles are compared case-insensitively — lower-case
 * alleles are legal VCF and the repo ships a file of them.
 */
export function classifyAllele(
  start0: number,
  refIn: string,
  altIn: string,
): AlleleClass {
  const ref = refIn.toUpperCase()
  const alt = altIn.toUpperCase()
  if (isSymbolic(alt)) {
    return { kind: 'symbolic' }
  }
  if (isBreakend(alt)) {
    return { kind: 'breakend' }
  }
  // `*` is an upstream deletion's placeholder and `.` no ALT at all: neither
  // names a column of this record
  if (alt === '*' || alt === '.' || alt === '') {
    return { kind: 'complex' }
  }
  const k = commonPrefixLength(ref, alt)
  if (ref.length === alt.length) {
    if (k === ref.length) {
      // REF == ALT: nothing differs, so no column to sort on
      return { kind: ref.length === 1 ? 'snv' : 'mnv' }
    }
    return {
      kind: ref.length === 1 ? 'snv' : 'mnv',
      sort: { type: 'basePair', pos: start0 + k },
    }
  }
  if (ref.length > alt.length) {
    // ALT a prefix of REF gives k = len(ALT), the first deleted base; an
    // unanchored deletion (k = 0) sorts on `start`, the first base the gap
    // could cover
    return { kind: 'del', sort: { type: 'basePair', pos: start0 + k } }
  }
  if (k === ref.length) {
    // REF a prefix of ALT: the inserted bases sit before the reference base
    // after the anchor, which is where the alignments sort records them
    return { kind: 'ins', sort: { type: 'insertion', pos: start0 + k } }
  }
  return { kind: 'complex', sort: { type: 'basePair', pos: start0 + k } }
}

function combinedKind(kinds: CandidateKind[]): CandidateKind {
  if (kinds.includes('breakend')) {
    return 'breakend'
  }
  if (kinds.includes('symbolic')) {
    return 'symbolic'
  }
  const first = kinds[0]
  return first !== undefined && kinds.every(k => k === first)
    ? first
    : 'complex'
}

/**
 * The column one record sorts on, and its kind. Multi-allelic: each ALT is
 * classified alone, and the leftmost column wins, a `basePair` sort winning a
 * tie — a deletion's first deleted base and an insertion before it are the
 * same position, and the base column ranks the deletion carriers as well as
 * the mismatches.
 */
export function classifyRecord(
  start0: number,
  ref: string,
  alts: readonly string[],
): { kind: CandidateKind; sort?: CandidateSort } {
  const classes = alts.map(alt => classifyAllele(start0, ref, alt))
  let sort: CandidateSort | undefined
  for (const c of classes) {
    if (
      c.sort &&
      (!sort ||
        c.sort.pos < sort.pos ||
        (c.sort.pos === sort.pos &&
          c.sort.type === 'basePair' &&
          sort.type !== 'basePair'))
    ) {
      sort = c.sort
    }
  }
  return {
    kind:
      classes.length > 0 ? combinedKind(classes.map(c => c.kind)) : 'complex',
    sort,
  }
}

/** {@link classifyRecord}'s column alone. */
export function sortCoordinate(
  start0: number,
  ref: string,
  alts: readonly string[],
) {
  return classifyRecord(start0, ref, alts).sort
}

export function hasSymbolicAlt(alts: readonly string[]) {
  return alts.some(isSymbolic)
}
