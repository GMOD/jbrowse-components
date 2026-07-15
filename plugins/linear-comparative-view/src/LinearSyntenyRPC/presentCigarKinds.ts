import { CIGAR_OP_D, CIGAR_OP_I, CIGAR_OP_N } from '@jbrowse/synteny-core'

import { KIND_CIGAR_D, KIND_CIGAR_I, KIND_CIGAR_N } from './syntenyColors.ts'

import type { CigarOpMask } from '@jbrowse/synteny-core'

const ALL_INDEL_OPS = CIGAR_OP_I | CIGAR_OP_D | CIGAR_OP_N

// Bitmask of the CIGAR indel ops appearing in a drawn geometry's per-instance
// `kinds`. The worker only emits an indel instance for a >=1px op (sub-pixel
// indels are merged away), so a set bit means a visible-width op of that kind
// is on screen — the legend keys its indel chips off this. `instanceCount`
// bounds the scan since `kinds` may carry unused trailing capacity; the scan
// early-exits once all three indel ops have been seen.
export function computePresentCigarKinds(
  kinds: Uint8Array,
  instanceCount: number,
): CigarOpMask {
  let mask = 0
  for (let i = 0; i < instanceCount && mask !== ALL_INDEL_OPS; i++) {
    const k = kinds[i]!
    if (k === KIND_CIGAR_I) {
      mask |= CIGAR_OP_I
    } else if (k === KIND_CIGAR_D) {
      mask |= CIGAR_OP_D
    } else if (k === KIND_CIGAR_N) {
      mask |= CIGAR_OP_N
    }
  }
  return mask
}
