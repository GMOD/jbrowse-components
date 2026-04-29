import type { SoftclipData } from '../../shared/webglRpcTypes.ts'

// Builds per-base arrays from softclip sequences (only populated when
// showSoftClipping is on). Each base in each clipped sequence becomes one
// instance in the softclip-bases pass. Bases at clipStart < regionStart
// are clipped by the GPU rasterizer, so we don't filter on regionStart here.
export function buildSoftclipBaseArrays(
  softclips: SoftclipData[],
  getReadIndex: (featureId: string) => number,
) {
  const count = softclips.reduce(
    (sum, sc) => sum + (sc.sequence?.length ?? 0),
    0,
  )
  const softclipBasePositions = new Uint32Array(count)
  const softclipBaseYs = new Uint16Array(count)
  const softclipBaseBases = new Uint8Array(count)
  const softclipBaseReadIndices = new Uint32Array(count)
  let i = 0
  for (const sc of softclips) {
    if (!sc.sequence) {
      continue
    }
    const ri = getReadIndex(sc.featureId)
    for (let k = 0; k < sc.sequence.length; k++) {
      softclipBasePositions[i] = sc.clipStart + k
      softclipBaseBases[i] = sc.sequence.charCodeAt(k)
      softclipBaseReadIndices[i] = ri
      i++
    }
  }
  return {
    softclipBasePositions,
    softclipBaseYs,
    softclipBaseBases,
    softclipBaseReadIndices,
  }
}
