export const RECT_STRIDE = 8
export const LINE_STRIDE = 8
export const ARROW_STRIDE = 7

export function interleaveRects(
  positions: Uint32Array,
  ys: Float32Array,
  heights: Float32Array,
  colors: Uint8Array,
  count: number,
) {
  const buf = new ArrayBuffer(count * RECT_STRIDE * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * RECT_STRIDE
    u32[off] = positions[i * 2]!
    u32[off + 1] = positions[i * 2 + 1]!
    f32[off + 2] = ys[i]!
    f32[off + 3] = heights[i]!
    f32[off + 4] = colors[i * 4]! / 255
    f32[off + 5] = colors[i * 4 + 1]! / 255
    f32[off + 6] = colors[i * 4 + 2]! / 255
    f32[off + 7] = colors[i * 4 + 3]! / 255
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
