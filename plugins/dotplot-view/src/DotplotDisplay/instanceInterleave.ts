import {
  INSTANCE_OFFSET_F32,
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/dotplot.iface.generated.ts'

import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { InstanceCacheOpts } from '@jbrowse/render-core/instanceCache'

// The GPU-side twin of linear-comparative-view's
// LinearSyntenyDisplay/instanceInterleave.ts — same reason: both comparative
// displays split rpcProps from gpuProps (geometry from palette), so both
// re-upload on a recolor over unchanged geometry. The recolor MACHINERY is no
// longer duplicated (`createInstanceCache`); what stays per-plugin is the
// interleave itself, whose lanes differ.
//
// Hand-written rather than the generated `packInstances` most GPU renderers
// call: `packInstances` takes one flat ArrayLike per field, and every
// coordinate here is `cumBp - base` — feeding it would mean materializing four
// whole extra n-length arrays. Only the loop is local; the offsets and stride
// still come from the shader's generated interface, so the layout can't drift.
//
// Coordinates go window-relative HERE rather than in the worker, which is where
// this diverges from synteny: dotplot's geometry stays absolute Float64 cumBp
// because its Canvas2D and SVG renderers consume it unchanged. See
// agent-docs/reference/BP_PRECISION.md §"Synteny + dotplot".
export function interleaveInstances(data: DotplotGeometryData) {
  const { x1, y1, x2, y2, colors, baseH, baseV, instanceCount: n } = data
  const buf = new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)

  for (let i = 0; i < n; i++) {
    const off = i * INSTANCE_STRIDE_WORDS
    f[off + INSTANCE_OFFSET_F32.x1] = x1[i]! - baseH
    f[off + INSTANCE_OFFSET_F32.y1] = y1[i]! - baseV
    f[off + INSTANCE_OFFSET_F32.x2] = x2[i]! - baseH
    f[off + INSTANCE_OFFSET_F32.y2] = y2[i]! - baseV
    u32[off + INSTANCE_OFFSET_U32.color] = colors[i]!
  }
  return buf
}

// How the renderer caches the buffer above and recolors it: a colorBy or
// track-color change produces new `colors` over unchanged geometry, and
// patching the single 4-byte lane skips re-packing the four coordinate lanes.
// The GPU re-upload still happens (the HAL has no partial-buffer update), but
// the dominant CPU interleave is avoided. An alpha-slider drag does NOT reach
// here at all — opacity is the `alpha` uniform, not a packed byte.
//
// Declared beside `interleaveInstances` because the offsets are the ones it
// writes; a patch landing in a different lane than the pack is the one way this
// goes wrong, and reading both off the same generated constants is what stops
// it. `x1` is the geometry token because buildLineSegments replaces every
// coordinate array atomically — a color array would never invalidate.
export const DOTPLOT_INSTANCE_CACHE: InstanceCacheOpts<DotplotGeometryData> = {
  geomToken: d => d.x1,
  colors: d => d.colors,
  interleave: interleaveInstances,
  strideWords: INSTANCE_STRIDE_WORDS,
  colorOffsetWords: INSTANCE_OFFSET_U32.color,
}
