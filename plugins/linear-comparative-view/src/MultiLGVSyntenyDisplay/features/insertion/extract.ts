import { addInstance } from '../../shared/instanceWriter.ts'

import type { CigarColorArrays } from '../../shared/instanceWriter.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

// Synteny insertions are 1bp markers (refPos == endPos), drawn as a thin
// vertical line by the fill shader.
export function emitInsertionGpu(
  builder: InstanceBuilder,
  refPos: number,
  genomeRow: number,
  featureId: number,
  rgba: CigarColorArrays,
) {
  addInstance(builder, refPos, refPos, genomeRow, featureId, rgba.insertion)
}
