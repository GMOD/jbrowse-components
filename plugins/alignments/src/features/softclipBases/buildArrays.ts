import type { SoftclipData } from '../../shared/webglRpcTypes.ts'

// Builds per-base arrays from softclip sequences (only populated when
// showSoftClips is on). Each clipped base inside [start, end) becomes one
// instance in the softclip-bases pass; a long read's clip running past the
// fetched region would otherwise ship kilobases nothing can draw.
export function buildSoftclipBaseArrays(
  softclips: SoftclipData[],
  start: number,
  end: number,
) {
  const spanOf = (sc: SoftclipData, sequence = sc.sequence ?? '') =>
    [
      Math.max(0, Math.ceil(start - sc.clipStart)),
      Math.min(sequence.length, Math.ceil(end - sc.clipStart)),
      sequence,
    ] as const
  const count = softclips.reduce((sum, sc) => {
    const [from, to] = spanOf(sc)
    return sum + Math.max(0, to - from)
  }, 0)
  const softclipBasePositions = new Uint32Array(count)
  const softclipBaseBases = new Uint8Array(count)
  const softclipBaseReadIndices = new Uint32Array(count)
  let i = 0
  for (const sc of softclips) {
    const [from, to, sequence] = spanOf(sc)
    const ri = sc.readIndex
    for (let k = from; k < to; k++) {
      softclipBasePositions[i] = sc.clipStart + k
      // uppercase the ASCII base (CRAM may emit lowercase) so the Canvas2D
      // baseColors map (uppercase-keyed) matches the GPU shader path
      softclipBaseBases[i] = sequence.charCodeAt(k) & ~0x20
      softclipBaseReadIndices[i] = ri
      i++
    }
  }
  return {
    softclipBasePositions,
    softclipBaseBases,
    softclipBaseReadIndices,
  }
}
