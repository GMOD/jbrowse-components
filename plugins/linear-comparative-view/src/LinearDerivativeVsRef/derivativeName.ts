import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// chr3 → chr10 → chr12 → chr3 reads as one name; a path that revisits a
// chromosome should say so once rather than twice, so the name is built from
// the candidate's deduplicated refNames.
export function derivativeName(candidate: DerivativeCandidate) {
  return `der_${candidate.refNames.join('_')}`
}
