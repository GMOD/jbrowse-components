import type { HardclipData } from '../../shared/webglRpcTypes.ts'
import type { ClipMismatch } from '@jbrowse/alignments-core'

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
