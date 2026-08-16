// Reading the modification-coverage instance buffer back, the same shape
// `snpSegments.ts` and `interbaseSegments.ts` have for their two layers.
//
// Only the buffer ships (`buildCoverageResultFields`), so a reader that isn't a
// draw pass comes through here. Every field access is the `.slang`'s own
// generated getter, which binds the field to its view.

import {
  INSTANCE_STRIDE_BYTES as MOD_COV_STRIDE_BYTES,
  getInstancePackedColor,
  getInstancePosition,
  getInstanceRelDepth,
  getInstanceSegHeight,
  getInstanceYOffset,
} from './modCoverageLayout.generated.ts'

export interface ModCovSegment {
  position: number
  /** Fractions of THIS position's bar, not of the band. */
  yOffset: number
  height: number
  /** Pre-packed ABGR. */
  packedColor: number
  /** totalDepthAtPos / regionMaxDepth. */
  relDepth: number
}

export function readModCovSegments(buffer: ArrayBuffer): ModCovSegment[] {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const count = buffer.byteLength / MOD_COV_STRIDE_BYTES
  const out: ModCovSegment[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      position: getInstancePosition(u32, i),
      yOffset: getInstanceYOffset(f32, i),
      height: getInstanceSegHeight(f32, i),
      packedColor: getInstancePackedColor(u32, i),
      relDepth: getInstanceRelDepth(f32, i),
    })
  }
  return out
}
