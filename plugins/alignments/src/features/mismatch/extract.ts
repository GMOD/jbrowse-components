import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'

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
    // forEachMismatch yields -1 (or undefined) when the read has no QUAL, which
    // becomes the shader's own sentinel. A reported 0 is passed through as the
    // Phred 0 it is: it used to be folded in with the missing case and so drew
    // opaque, one step the wrong side of Phred 1's near-invisible 0.02.
    qual: qual !== undefined && qual >= 0 ? qual : QUAL_UNAVAILABLE,
  })
}
