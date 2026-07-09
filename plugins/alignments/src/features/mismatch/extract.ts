import type { MismatchData } from '../../shared/webglRpcTypes.ts'

export function emitMismatch(
  start: number,
  base: string,
  qual: number | undefined,
  readIndex: number,
  featureStart: number,
  strand: number,
  mismatchesData: MismatchData[],
) {
  mismatchesData.push({
    readIndex,
    position: featureStart + start,
    // uppercase the single ASCII base without allocating a string (CRAM may
    // emit lowercase); ~2x faster than base.toUpperCase().charCodeAt(0)
    base: base.charCodeAt(0) & ~0x20,
    strand: strand === -1 ? -1 : 1,
    // forEachMismatch yields -1 (or undefined) when the read has no QUAL; 0
    // means "no fade" downstream, matching a missing quality.
    qual: qual !== undefined && qual > 0 ? qual : 0,
  })
}
