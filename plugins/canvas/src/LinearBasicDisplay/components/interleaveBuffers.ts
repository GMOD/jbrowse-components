import {
  FIELD_OFFSET_F32 as ARROW_F32,
  INSTANCE_STRIDE_BYTES as ARROW_STRIDE_BYTES,
  INSTANCE_STRIDE_F32 as ARROW_STRIDE_F32,
} from './shaders/arrow.generated.ts'
import {
  FIELD_OFFSET_F32 as LINE_F32,
  INSTANCE_STRIDE_BYTES as LINE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32 as LINE_STRIDE_F32,
} from './shaders/line.generated.ts'
import {
  FIELD_OFFSET_F32 as RECT_F32,
  INSTANCE_STRIDE_BYTES as RECT_STRIDE_BYTES,
  INSTANCE_STRIDE_F32 as RECT_STRIDE_F32,
} from './shaders/rect.generated.ts'

// Each of these packs parallel arrays (produced by the feature RPC worker)
// into the corresponding shader's vertex buffer layout. Field offsets come
// from the shader's generated constants — renaming a `.slang` field makes
// TS compilation fail here.
//
// `colors` is already packed RGBA32 (one u32 per instance); the shader
// unpacks via `unpackRGBA`.

export function interleaveRects(
  positions: Uint32Array,
  ys: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * RECT_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * RECT_STRIDE_F32
    u32[off + RECT_F32.startEnd] = positions[i * 2]!
    u32[off + RECT_F32.startEnd + 1] = positions[i * 2 + 1]!
    f32[off + RECT_F32.y] = ys[i]!
    f32[off + RECT_F32.height] = heights[i]!
    u32[off + RECT_F32.color] = colors[i]!
  }
  return buf
}

export function interleaveLines(
  positions: Uint32Array,
  ys: Float32Array,
  directions: Int8Array,
  colors: Uint32Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * LINE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * LINE_STRIDE_F32
    u32[off + LINE_F32.startEnd] = positions[i * 2]!
    u32[off + LINE_F32.startEnd + 1] = positions[i * 2 + 1]!
    f32[off + LINE_F32.y] = ys[i]!
    f32[off + LINE_F32.direction] = directions[i]!
    u32[off + LINE_F32.color] = colors[i]!
  }
  return buf
}

export function interleaveArrows(
  xs: Uint32Array,
  ys: Float32Array,
  directions: Int8Array,
  colors: Uint32Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * ARROW_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * ARROW_STRIDE_F32
    u32[off + ARROW_F32.x] = xs[i]!
    f32[off + ARROW_F32.y] = ys[i]!
    f32[off + ARROW_F32.direction] = directions[i]!
    u32[off + ARROW_F32.color] = colors[i]!
  }
  return buf
}
