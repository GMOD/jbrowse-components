import {
  FIELD_OFFSET_F32 as RECT_F32,
  INSTANCE_STRIDE_BYTES as RECT_STRIDE_BYTES,
  INSTANCE_STRIDE_F32 as RECT_STRIDE_F32,
} from './shaders/rect.generated.ts'

// Exported for callers that think in 4-byte "slot" units; new code should
// prefer the *_BYTES constants directly.
export const RECT_STRIDE = RECT_STRIDE_F32
export const LINE_STRIDE = 8
export const ARROW_STRIDE = 8

// Rect layout is the single source of truth in rect.slang. This function
// packs parallel arrays (as produced by the feature RPC worker) into the
// 20-byte-per-instance vertex buffer the rect shader reads. Field offsets
// come from the shader via generated constants — renaming a rect.slang field
// would produce a TS compile error here.
//
// `colors` is already packed RGBA32 (one u32 per rect) so it just gets
// copied to the color slot. The rect shader unpacks via `unpackRGBA(c)`.
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
  colors: Uint8Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * LINE_STRIDE * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * LINE_STRIDE
    u32[off] = positions[i * 2]!
    u32[off + 1] = positions[i * 2 + 1]!
    f32[off + 2] = ys[i]!
    f32[off + 3] = directions[i]!
    f32[off + 4] = colors[i * 4]! / 255
    f32[off + 5] = colors[i * 4 + 1]! / 255
    f32[off + 6] = colors[i * 4 + 2]! / 255
    f32[off + 7] = colors[i * 4 + 3]! / 255
  }
  return buf
}

export function interleaveArrows(
  xs: Uint32Array,
  ys: Float32Array,
  directions: Int8Array,
  colors: Uint8Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * ARROW_STRIDE * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * ARROW_STRIDE
    u32[off] = xs[i]!
    f32[off + 1] = colors[i * 4 + 3]! / 255
    f32[off + 2] = ys[i]!
    f32[off + 3] = directions[i]!
    f32[off + 4] = colors[i * 4]! / 255
    f32[off + 5] = colors[i * 4 + 1]! / 255
    f32[off + 6] = colors[i * 4 + 2]! / 255
  }
  return buf
}
