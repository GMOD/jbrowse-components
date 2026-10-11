import {
  colorFwdStrand,
  colorRevStrand,
  resolvePalette,
} from '@jbrowse/core/ui/palette'

/**
 * The alignments display's own colors, from the default light palette, so a
 * host draws reads, gaps, coverage and mismatches in them rather than in a
 * copy that drifts: a read under the plain fill, each strand (a splice
 * junction's too), a splice skip, a deletion, an insertion, a soft and a hard
 * clip, the coverage band and each base of a mismatch.
 */
export function alignmentColors() {
  const p = resolvePalette()
  return {
    read: p.alignmentFill.pairLR,
    forward: colorFwdStrand,
    reverse: colorRevStrand,
    skip: p.skip,
    deletion: p.deletion,
    insertion: p.insertion,
    softclip: p.softclip,
    hardclip: p.hardclip,
    coverage: p.coverage,
    bases: Object.fromEntries(
      Object.entries(p.bases).map(([base, color]) => [base, color.main]),
    ),
  }
}
