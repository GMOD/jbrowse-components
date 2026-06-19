import type { SoftclipData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

export function emitSoftclip(
  start: number,
  cliplen: number,
  featureId: string,
  featureStart: number,
  feature: Feature,
  softclipsData: SoftclipData[],
  showSoftClipping: boolean,
) {
  const isLeftClip = start === 0
  const clipStart = isLeftClip ? featureStart - cliplen : featureStart + start
  const seq = showSoftClipping
    ? (feature.get('seq') as string | undefined)
    : undefined
  const sequence = seq
    ? seq.slice(
        isLeftClip ? 0 : seq.length - cliplen,
        isLeftClip ? cliplen : seq.length,
      )
    : undefined
  softclipsData.push({
    featureId,
    position: featureStart + start,
    clipStart,
    length: cliplen,
    sequence,
  })
}
