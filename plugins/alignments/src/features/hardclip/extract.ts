import type { ClipMismatch } from '../../shared/types.ts'
import type { HardclipData } from '../../shared/webglRpcTypes.ts'

export function emitHardclip(
  mm: ClipMismatch,
  featureId: string,
  featureStart: number,
  hardclipsData: HardclipData[],
) {
  hardclipsData.push({
    featureId,
    position: featureStart + mm.start,
    length: mm.cliplen,
  })
}
