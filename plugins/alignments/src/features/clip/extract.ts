import type { HardclipData, SoftclipData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

// Both clip emitters, together because the `clip` pass draws both kinds from one
// merged interbase partition and `extractCigarFeatures` calls them from the same
// CIGAR walk. Only the soft one reads the read's sequence, and only when
// `showSoftClipping` is on — that `sequence` field is the whole input to the
// separate `softclipBases` pass (features/softclipBases/buildArrays.ts), so the
// bar and the letters share an extraction and diverge downstream.
export function emitSoftclip(
  start: number,
  cliplen: number,
  readIndex: number,
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
    readIndex,
    position: featureStart + start,
    clipStart,
    length: cliplen,
    sequence,
  })
}

export function emitHardclip(
  start: number,
  cliplen: number,
  readIndex: number,
  featureStart: number,
  hardclipsData: HardclipData[],
) {
  hardclipsData.push({
    readIndex,
    position: featureStart + start,
    length: cliplen,
  })
}
