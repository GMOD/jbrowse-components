import {
  INSTANCE_OFFSET_F32,
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/syntenyFillStraight.iface.generated.ts'
import {
  isCigarKind,
  isMarkerKind,
} from './shaders/syntenyTypes.js.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Hand-written rather than the generated `packInstances` the repo's other GPU
// renderers call: `packInstances` takes one flat ArrayLike per field, and this
// layout's `featureId` is `instanceFeatureIdx[i] + 1`, so feeding it would mean
// materializing a whole extra n-length array. Only the loop is local — the
// offsets and stride still come from the shader's generated interface, so the
// layout itself cannot drift.
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
    const off = i * INSTANCE_STRIDE_WORDS
    f[off + INSTANCE_OFFSET_F32.bp1] = bp1[i]!
    f[off + INSTANCE_OFFSET_F32.bp2] = bp2[i]!
    f[off + INSTANCE_OFFSET_F32.bp3] = bp3[i]!
    f[off + INSTANCE_OFFSET_F32.bp4] = bp4[i]!
    u32[off + INSTANCE_OFFSET_U32.color] = colors[i]!
    // featureId goes through the Float32 view (shader reads it as a float
    // attribute + compares to the float hovered/clickedFeatureId uniforms), so
    // it's exact only to 2^24 ~= 16.7M features. Past that, adjacent ids
    // collide and hover/click highlights the wrong feature (visual only).
    // Genome-size-independent; likeliest to surface on dense all-vs-all PAF.
    // Fix = make featureId a uint attribute+uniform. See OTHER_IDEAS.md
    // "Synteny featureId instance ceiling".
    f[off + INSTANCE_OFFSET_F32.featureId] = instanceFeatureIdx[i]! + 1
    f[off + INSTANCE_OFFSET_F32.alignmentLength] = alignmentLengths[i]!
    f[off + INSTANCE_OFFSET_F32.kind] = kinds[i]!
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
    u32[i * INSTANCE_STRIDE_WORDS + INSTANCE_OFFSET_U32.color] = colors[i]!
  }
}

// The instances the clicked-outline (edge) pass would actually paint, copied out
// of an already-interleaved region buffer into a buffer of their own.
//
// The edge pass used to be drawn against the fill pass's buffer, which meant
// every instance in the region ran the vertex shader and all but the clicked
// one early-outed to a degenerate vertex: on a 500k-instance whole-genome view,
// 3M wasted vertex invocations per frame in straight mode and 24M in curve mode
// (48 verts/instance), for one outline, for as long as the selection is live.
// A base feature is one instance per region, so this makes the pass ~1.
//
// SYNC: the predicate is `isClickedSilhouette` in syntenyTypes.slang — the kind
// tests here are that shader's own, generated (adr-051). The shader keeps its
// copy, so this narrowing can only ever remove instances the GPU would have
// discarded anyway. It is exactly narrower in one case: the shader compares
// featureIds as Float32 (`abs(diff) < 0.5`), which aliases neighbours past 2^24
// features (see interleaveInstances), while the integer compare here cannot.
export function packClickedOutlineInstances(
  data: SyntenyInstanceData,
  clickedFeatureId: number,
  interleaved: ArrayBuffer,
) {
  const { instanceFeatureIdx, kinds, instanceCount } = data
  const matches: number[] = []
  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    if (
      instanceFeatureIdx[i]! + 1 === clickedFeatureId &&
      !isCigarKind(kind) &&
      !isMarkerKind(kind)
    ) {
      matches.push(i)
    }
  }
  const count = matches.length
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const dst = new Uint8Array(buf)
  const src = new Uint8Array(interleaved)
  for (let m = 0; m < count; m++) {
    const off = matches[m]! * INSTANCE_STRIDE_BYTES
    dst.set(
      src.subarray(off, off + INSTANCE_STRIDE_BYTES),
      m * INSTANCE_STRIDE_BYTES,
    )
  }
  return { buf, count }
}
