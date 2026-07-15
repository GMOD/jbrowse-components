import type { HardclipData } from '../../shared/webglRpcTypes.ts'

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
