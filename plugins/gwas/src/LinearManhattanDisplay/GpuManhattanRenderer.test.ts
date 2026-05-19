import { buildInstanceBuffer } from './GpuManhattanRenderer.ts'

import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

function mkData(
  positions: number[],
  scores: number[],
  colors: number[],
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(positions),
    scores: new Float32Array(scores),
    colors: new Uint32Array(colors),
    numFeatures: positions.length,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    scoreSum: 0,
    scoreSumSq: 0,
  }
}

test('packs absPosition / score / color at the offsets the shader expects', () => {
  const buf = buildInstanceBuffer(
    mkData([42, 1337], [0.5, 7.25], [0xff0000ff, 0xff00ff00]),
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const stride = shader.INSTANCE_STRIDE_F32

  expect(u32[shader.FIELD_OFFSET_F32.absPosition]).toBe(42)
  expect(f32[shader.FIELD_OFFSET_F32.score]).toBeCloseTo(0.5)
  expect(u32[shader.FIELD_OFFSET_F32.color]).toBe(0xff0000ff)

  expect(u32[stride + shader.FIELD_OFFSET_F32.absPosition]).toBe(1337)
  expect(f32[stride + shader.FIELD_OFFSET_F32.score]).toBeCloseTo(7.25)
  expect(u32[stride + shader.FIELD_OFFSET_F32.color]).toBe(0xff00ff00)
})

test('produces a buffer sized to numFeatures × stride', () => {
  const buf = buildInstanceBuffer(mkData([1, 2, 3], [0, 0, 0], [0, 0, 0]))
  expect(buf.byteLength).toBe(3 * shader.INSTANCE_STRIDE_BYTES)
})

test('preserves uint32 positions above the float32-safe range', () => {
  // chr1 ≈ 250 Mbp; bigger than 2^24 — would lose precision if stored as f32.
  const bigPos = 250_000_001
  const buf = buildInstanceBuffer(mkData([bigPos], [1], [0]))
  expect(new Uint32Array(buf)[shader.FIELD_OFFSET_F32.absPosition]).toBe(bigPos)
})
