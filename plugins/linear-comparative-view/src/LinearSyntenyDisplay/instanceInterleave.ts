import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/syntenyFillStraight.iface.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export function interleaveInstances(data: SyntenyInstanceData) {
  const {
    bp1,
    bp2,
    bp3,
    bp4,
    colors,
    kinds,
    instanceFeatureIdx,
    alignmentLengths,
    instanceCount: n,
  } = data
  const buf = new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)

  for (let i = 0; i < n; i++) {
    const off = i * INSTANCE_STRIDE_F32
    f[off + FIELD_OFFSET_F32.bp1] = bp1[i]!
    f[off + FIELD_OFFSET_F32.bp2] = bp2[i]!
    f[off + FIELD_OFFSET_F32.bp3] = bp3[i]!
    f[off + FIELD_OFFSET_F32.bp4] = bp4[i]!
    u32[off + FIELD_OFFSET_F32.color] = colors[i]!
    // featureId goes through the Float32 view (shader reads it as a float
    // attribute + compares to the float hovered/clickedFeatureId uniforms), so
    // it's exact only to 2^24 ~= 16.7M features. Past that, adjacent ids
    // collide and hover/click highlights the wrong feature (visual only).
    // Genome-size-independent; likeliest to surface on dense all-vs-all PAF.
    // Fix = make featureId a uint attribute+uniform. See OTHER_IDEAS.md
    // "Synteny coordinate-precision ceilings".
    f[off + FIELD_OFFSET_F32.featureId] = instanceFeatureIdx[i]! + 1
    f[off + FIELD_OFFSET_F32.alignmentLength] = alignmentLengths[i]!
    f[off + FIELD_OFFSET_F32.kind] = kinds[i]!
  }
  return buf
}

// Overwrite only the per-instance color lane of an already-interleaved buffer.
// A colorBy / opacityByIdentity toggle produces new `colors` over unchanged
// geometry, so patching the single 4-byte color field per instance skips
// re-packing the other 11 lanes. The GPU re-upload still happens (the HAL has
// no partial-buffer update), but the dominant CPU interleave is avoided.
// SYNC: the color write mirrors interleaveInstances exactly.
export function patchInstanceColors(buf: ArrayBuffer, colors: Uint32Array) {
  const u32 = new Uint32Array(buf)
  for (let i = 0, n = colors.length; i < n; i++) {
    u32[i * INSTANCE_STRIDE_F32 + FIELD_OFFSET_F32.color] = colors[i]!
  }
}
