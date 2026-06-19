import type { HardclipData } from '../../shared/webglRpcTypes.ts'

export function emitHardclip(
  start: number,
  cliplen: number,
  featureId: string,
  featureStart: number,
  hardclipsData: HardclipData[],
) {
  hardclipsData.push({
    featureId,
    position: featureStart + start,
    length: cliplen,
  })
}
