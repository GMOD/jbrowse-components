import { addInstance } from '../../shared/instanceWriter.ts'

import type { CigarColorArrays } from '../../shared/instanceWriter.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

export function emitMismatchGpu(
  builder: InstanceBuilder,
  refPos: number,
  len: number,
  queryBase: string | undefined,
  genomeRow: number,
  featureId: number,
  rgba: CigarColorArrays,
) {
  const color = (queryBase ? rgba.bases[queryBase] : undefined) ?? rgba.mismatch
  addInstance(builder, refPos, refPos + len, genomeRow, featureId, color)
}
