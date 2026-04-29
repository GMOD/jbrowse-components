import { baseToAscii } from '../../shared/webglRpcUtils.ts'

import type { Mismatch } from '../../shared/types.ts'
import type { MismatchData } from '../../shared/webglRpcTypes.ts'

export function emitMismatch(
  mm: Extract<Mismatch, { type: 'mismatch' }>,
  featureId: string,
  featureStart: number,
  strand: number,
  mismatchesData: MismatchData[],
) {
  mismatchesData.push({
    featureId,
    position: featureStart + mm.start,
    base: baseToAscii(mm.base),
    strand: strand === -1 ? -1 : 1,
  })
}
