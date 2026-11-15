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
  const firstBase = (sc: SoftclipData) => Math.max(0, start - sc.clipStart)
  const pastLastBase = (sc: SoftclipData) =>
    Math.min(sc.sequence?.length ?? 0, end - sc.clipStart)
  const count = softclips.reduce(
    (sum, sc) => sum + Math.max(0, pastLastBase(sc) - firstBase(sc)),
    0,
  )
  const softclipBasePositions = new Uint32Array(count)
  const softclipBaseBases = new Uint8Array(count)
  const softclipBaseReadIndices = new Uint32Array(count)
  let i = 0
  for (const sc of softclips) {
    const sequence = sc.sequence ?? ''
    const ri = sc.readIndex
    for (let k = firstBase(sc), to = pastLastBase(sc); k < to; k++) {
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
