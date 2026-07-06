import { NO_CIGAR_OPS } from '@jbrowse/synteny-core'

import { KIND_CIGAR_D, KIND_CIGAR_I, KIND_CIGAR_N } from './syntenyColors.ts'

import type { CigarOpPresence } from '@jbrowse/synteny-core'

// Which CIGAR indel ops appear in a drawn geometry's per-instance `kinds`. The
// worker only emits an indel instance for a >=1px op (sub-pixel indels are
// merged away), so a `true` here means a visible-width op of that kind is on
// screen — the legend keys its indel chips off this. `instanceCount` bounds the
// scan since `kinds` may carry unused trailing capacity.
export function computePresentCigarKinds(
  kinds: Uint8Array,
  instanceCount: number,
): CigarOpPresence {
  let I = false
  let D = false
  let N = false
  for (let i = 0; i < instanceCount && !(I && D && N); i++) {
    const k = kinds[i]!
    if (k === KIND_CIGAR_I) {
      I = true
    } else if (k === KIND_CIGAR_D) {
      D = true
    } else if (k === KIND_CIGAR_N) {
      N = true
    }
  }
  return I || D || N ? { I, D, N } : NO_CIGAR_OPS
}
