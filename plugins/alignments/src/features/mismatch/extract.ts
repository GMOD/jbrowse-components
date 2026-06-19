import type { MismatchData } from '../../shared/webglRpcTypes.ts'

export function emitMismatch(
  start: number,
  base: string,
  featureId: string,
  featureStart: number,
  strand: number,
  mismatchesData: MismatchData[],
) {
  mismatchesData.push({
    featureId,
    position: featureStart + start,
    // uppercase the single ASCII base without allocating a string (CRAM may
    // emit lowercase); ~2x faster than base.toUpperCase().charCodeAt(0)
    base: base.charCodeAt(0) & ~0x20,
    strand: strand === -1 ? -1 : 1,
  })
}
