import { addInstance } from '../../shared/instanceWriter.ts'

import type { CigarColorArrays } from '../../shared/instanceWriter.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

export function emitDeletionGpu(
  builder: InstanceBuilder,
  refPos: number,
  len: number,
  genomeRow: number,
  featureId: number,
  rgba: CigarColorArrays,
) {
  addInstance(
    builder,
    refPos,
    refPos + len,
    genomeRow,
    featureId,
    rgba.deletion,
  )
}
