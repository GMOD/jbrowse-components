import { emitDeletionGpu } from '../features/deletion/extract.ts'
import { emitDeletionHit } from '../features/deletion/hitTest.ts'
import { emitInsertionGpu } from '../features/insertion/extract.ts'
import { emitInsertionHit } from '../features/insertion/hitTest.ts'
import { emitMismatchGpu } from '../features/mismatch/extract.ts'
import { emitMismatchHit } from '../features/mismatch/hitTest.ts'

import type { CigarHitResult } from './hitTestTypes.ts'
import type { CigarColorArrays } from './instanceWriter.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

// Builds a CIGAR/CS visitor that dispatches each op type to its
// per-feature emitter for the GPU fill InstanceBuilder. One visitor is
// allocated per feature; the inner ops loop reuses it.
export function buildGpuOpsVisitor(
  builder: InstanceBuilder,
  genomeRow: number,
  featureId: number,
  rgba: CigarColorArrays,
) {
  return {
    onMismatch(refPos: number, len: number, queryBase?: string) {
      emitMismatchGpu(
        builder,
        refPos,
        len,
        queryBase,
        genomeRow,
        featureId,
        rgba,
      )
    },
    onDeletion(refPos: number, len: number) {
      emitDeletionGpu(builder, refPos, len, genomeRow, featureId, rgba)
    },
    onInsertion(refPos: number, _len: number) {
      emitInsertionGpu(builder, refPos, genomeRow, featureId, rgba)
    },
  }
}

// Builds a CIGAR/CS visitor that dispatches each op type to its
// per-feature hit-test emitter. Items are pushed into the shared array
// which is then indexed in a Flatbush for spatial lookup.
export function buildHitTestOpsVisitor(items: CigarHitResult[]) {
  return {
    onMismatch(refPos: number, len: number, queryBase?: string) {
      emitMismatchHit(refPos, len, queryBase, items)
    },
    onDeletion(refPos: number, len: number) {
      emitDeletionHit(refPos, len, items)
    },
    onInsertion(refPos: number, len: number, insertionSeq?: string) {
      emitInsertionHit(refPos, len, insertionSeq, items)
    },
  }
}
