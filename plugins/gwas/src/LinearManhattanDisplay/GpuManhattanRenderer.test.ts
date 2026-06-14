import { MockHal } from '@jbrowse/render-core/hal'

import {
  GpuManhattanRenderer,
  MANHATTAN_PASSES,
  buildInstanceBuffer,
} from './GpuManhattanRenderer.ts'
import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

function mkData(
  positions: number[],
  scores: number[],
  colors: number[],
  ends: number[] = positions,
  glyphs: number[] = positions.map(() => 0),
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(positions),
    ends: new Uint32Array(ends),
    glyphs: new Uint8Array(glyphs),
    scores: new Float32Array(scores),
    colors: new Uint32Array(colors),
    numFeatures: positions.length,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    flatbushData: undefined,
  }
}

test('packs absPosition / absEnd / score / color / glyph at the offsets the shader expects', () => {
  const buf = buildInstanceBuffer(
    mkData(
      [42, 1337],
      [0.5, 7.25],
      [0xff0000ff, 0xff00ff00],
      [99, 2000],
      [0, 1],
    ),
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const stride = shader.INSTANCE_STRIDE_F32

  expect(u32[shader.FIELD_OFFSET_F32.absPosition]).toBe(42)
  expect(u32[shader.FIELD_OFFSET_F32.absEnd]).toBe(99)
  expect(f32[shader.FIELD_OFFSET_F32.score]).toBeCloseTo(0.5)
  expect(u32[shader.FIELD_OFFSET_F32.color]).toBe(0xff0000ff)
  expect(u32[shader.FIELD_OFFSET_F32.glyph]).toBe(0)

  expect(u32[stride + shader.FIELD_OFFSET_F32.absPosition]).toBe(1337)
  expect(u32[stride + shader.FIELD_OFFSET_F32.absEnd]).toBe(2000)
  expect(f32[stride + shader.FIELD_OFFSET_F32.score]).toBeCloseTo(7.25)
  expect(u32[stride + shader.FIELD_OFFSET_F32.color]).toBe(0xff00ff00)
  expect(u32[stride + shader.FIELD_OFFSET_F32.glyph]).toBe(1)
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

describe('reversed convention', () => {
  const state: ManhattanRenderState = {
    domainY: [0, 10],
    canvasWidth: 800,
    canvasHeight: 400,
  }
  const block = {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }

  function bpRangeLen(reversed: boolean) {
    const hal = new MockHal(MANHATTAN_PASSES)
    const renderer = new GpuManhattanRenderer(hal)
    const data = mkData([500], [5], [0xff0000ff])
    renderer.uploadRegion(0, data)
    renderer.renderBlocks([{ ...block, reversed }], new Map([[0, data]]), state)
    return hal.getLastUniformsF32()![shader.UNIFORM_OFFSET_F32.bpRangeX + 2]!
  }

  // Reversal is baked into bpRangeX's negated length (no separate `reversed`
  // uniform + shader flip, which double-flipped reversed points to the forward
  // orientation). Forward → positive length, reversed → negative.
  test('forward block writes a positive bpRangeX length', () => {
    expect(bpRangeLen(false)).toBeGreaterThan(0)
  })
  test('reversed block writes a negated bpRangeX length', () => {
    expect(bpRangeLen(true)).toBeLessThan(0)
  })
})
