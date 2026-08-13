import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
  InstanceWriter,
} from './shaders/syntenyFillStraight.iface.generated.ts'
import {
  isCigarKind,
  isMarkerKind,
} from './shaders/syntenyTypes.js.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { InstanceCacheOpts } from '@jbrowse/render-core/instanceCache'

// The generated `InstanceWriter` rather than the generated `packInstances`:
// `packInstances` takes one flat ArrayLike per field, and this layout's
// `featureId` is `instanceFeatureIdx[i] + 1`, so feeding it would mean
// materializing a whole extra n-length array. The writer takes the value per
// instance instead, so the computed field costs nothing extra and the field
// order, the per-field typed-array view and the stride are all the shader's.
//
// Seeded at exactly `n` and every instance is written, so `finish` returns the
// writer's own buffer with no right-sizing copy.
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
  const out = new InstanceWriter(n)
  for (let i = 0; i < n; i++) {
    // featureId goes through the Float32 view (shader reads it as a float
    // attribute + compares to the float hovered/clickedFeatureId uniforms), so
    // it's exact only to 2^24 ~= 16.7M features. Past that, adjacent ids
    // collide and hover/click highlights the wrong feature (visual only).
    // Genome-size-independent; likeliest to surface on dense all-vs-all PAF.
    // Fix = make featureId a uint attribute+uniform. See
    // agent-docs/ideas/synteny-comparative.md §"Synteny featureId instance
    // ceiling".
    out.push(
      bp1[i]!,
      bp2[i]!,
      bp3[i]!,
      bp4[i]!,
      colors[i]!,
      instanceFeatureIdx[i]! + 1,
      alignmentLengths[i]!,
      kinds[i]!,
    )
  }
  return out.finish()
}

// How the renderer caches the buffer above and recolors it: a colorBy /
// opacityByIdentity toggle produces new `colors` over unchanged geometry, so
// patching the single 4-byte color field per instance skips re-packing the
// other 11 lanes. The GPU re-upload still happens (the HAL has no
// partial-buffer update), but the dominant CPU interleave is avoided.
//
// Declared beside `interleaveInstances` because the offsets are the ones it
// writes; a patch landing in a different lane than the pack is the one way this
// goes wrong, and reading both off the same generated constants is what stops
// it. `bp1` is the geometry token because a refetch replaces every coordinate
// array atomically — a color array would never invalidate.
export const SYNTENY_INSTANCE_CACHE: InstanceCacheOpts<SyntenyInstanceData> = {
  geomToken: d => d.bp1,
  colors: d => d.colors,
  interleave: interleaveInstances,
  strideWords: INSTANCE_STRIDE_WORDS,
  colorOffsetWords: INSTANCE_OFFSET_U32.color,
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
// The predicate is `isClickedSilhouette` in syntenyTypes.slang — the kind tests
// here are that shader's own, generated (adr-051), so this is not a second
// copy. The shader keeps evaluating it too, which is what makes this narrowing
// safe: it can only ever remove instances the GPU would have discarded anyway.
// A DELIBERATE divergence, in one direction only: the shader compares
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
