// Reading the SNP-segment instance buffer back — the non-drawing half of what
// `computeSNPCoverage` writes, and the shape `interbaseSegments.ts` already has
// for the interbase histogram.
//
// The buffer is the only form of these segments, so this is where a reader that
// isn't a draw pass gets at them. Every field access is the `.slang`'s own
// generated getter, which binds the field to its view; nothing here restates a
// stride or an offset.

import {
  INSTANCE_STRIDE_BYTES as SNP_STRIDE_BYTES,
  getInstanceColorType,
  getInstancePosition,
  getInstanceRelDepth,
  getInstanceSegHeight,
  getInstanceYOffset,
} from './snpCoverageLayout.generated.ts'

export interface SnpSegment {
  position: number
  /** Fractions of THIS position's bar, not of the band. */
  yOffset: number
  height: number
  /** 1=A 2=C 3=G 4=T 5=N. */
  colorType: number
  /** totalDepthAtPos / regionMaxDepth. */
  relDepth: number
}

export function readSnpSegments(buffer: ArrayBuffer): SnpSegment[] {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const count = buffer.byteLength / SNP_STRIDE_BYTES
  const out: SnpSegment[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      position: getInstancePosition(u32, i),
      yOffset: getInstanceYOffset(f32, i),
      height: getInstanceSegHeight(f32, i),
      colorType: getInstanceColorType(f32, i),
      relDepth: getInstanceRelDepth(f32, i),
    })
  }
  return out
}
