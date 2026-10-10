import {
  colorFwdStrand,
  colorPairLR,
  colorRevStrand,
  resolvePalette,
} from '@jbrowse/core/ui/palette'

/**
 * The alignments display's own colors, from the default light palette, so a
 * host draws reads, gaps, coverage and mismatches in them rather than in a
 * copy that drifts: a read under the plain fill, each strand, a splice skip,
 * a deletion, the coverage band and each base of a mismatch.
 */
export function alignmentColors() {
  const p = resolvePalette()
  return {
    read: colorPairLR,
    forward: colorFwdStrand,
    reverse: colorRevStrand,
    skip: p.skip,
    deletion: p.deletion,
    coverage: p.coverage,
    bases: Object.fromEntries(
      Object.entries(p.bases).map(([base, color]) => [base, color.main]),
    ),
  }
}
