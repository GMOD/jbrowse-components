import type { ClipMismatch } from '../../shared/types.ts'
import type { SoftclipData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

export function emitSoftclip(
  mm: ClipMismatch,
  featureId: string,
  featureStart: number,
  feature: Feature,
  softclipsData: SoftclipData[],
  showSoftClipping: boolean,
) {
  const isLeftClip = mm.start === 0
  const clipStart = isLeftClip
    ? featureStart - mm.cliplen
    : featureStart + mm.start
  const seq = showSoftClipping
    ? (feature.get('seq') as string | undefined)
    : undefined
  const sequence = seq
    ? seq.slice(
        isLeftClip ? 0 : seq.length - mm.cliplen,
        isLeftClip ? mm.cliplen : seq.length,
      )
    : undefined
  softclipsData.push({
    featureId,
    position: featureStart + mm.start,
    clipStart,
    length: mm.cliplen,
    sequence,
  })
}
