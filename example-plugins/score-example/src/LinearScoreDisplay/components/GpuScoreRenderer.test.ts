import { MockHal } from '@jbrowse/render-core/hal'

import { GpuScoreRenderer, SCORE_PASSES } from './GpuScoreRenderer.ts'
import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

function mkData(
  starts: number[],
  ends: number[],
  scores: number[],
): ScoreRegionData {
  return {
    starts: new Uint32Array(starts),
    ends: new Uint32Array(ends),
    scores: new Float32Array(scores),
    numFeatures: starts.length,
  }
}

test('packs startBp / endBp / score at the offsets the shader expects', () => {
  const data = mkData([42, 1337], [99, 2000], [0.5, 0.25])
  const buf = shader.packInstances(
    { startBp: data.starts, endBp: data.ends, score: data.scores },
    data.numFeatures,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const stride = shader.INSTANCE_STRIDE_F32

  expect(u32[shader.FIELD_OFFSET_F32.startBp]).toBe(42)
  expect(u32[shader.FIELD_OFFSET_F32.endBp]).toBe(99)
  expect(f32[shader.FIELD_OFFSET_F32.score]).toBeCloseTo(0.5)

  expect(u32[stride + shader.FIELD_OFFSET_F32.startBp]).toBe(1337)
  expect(u32[stride + shader.FIELD_OFFSET_F32.endBp]).toBe(2000)
  expect(f32[stride + shader.FIELD_OFFSET_F32.score]).toBeCloseTo(0.25)
})

test('produces a buffer sized to numFeatures x stride', () => {
  const data = mkData([1, 2, 3], [2, 3, 4], [0, 0, 0])
  const buf = shader.packInstances(
    { startBp: data.starts, endBp: data.ends, score: data.scores },
    data.numFeatures,
  )
  expect(buf.byteLength).toBe(3 * shader.INSTANCE_STRIDE_BYTES)
})

test('preserves uint32 positions above the float32-safe range', () => {
  const bigPos = 250_000_001
  const buf = shader.packInstances(
    {
      startBp: new Uint32Array([bigPos]),
      endBp: new Uint32Array([bigPos + 1]),
      score: new Float32Array([1]),
    },
    1,
  )
  expect(new Uint32Array(buf)[shader.FIELD_OFFSET_F32.startBp]).toBe(bigPos)
})

describe('reversed convention', () => {
  const state: ScoreRenderState = {
    canvasWidth: 800,
    canvasHeight: 100,
    color: '#0068d1',
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
    const hal = new MockHal(SCORE_PASSES)
    const renderer = new GpuScoreRenderer(hal)
    const data = mkData([500], [600], [0.5])
    renderer.uploadRegion(0, data)
    renderer.renderBlocks([{ ...block, reversed }], new Map([[0, data]]), state)
    return hal.getLastUniformsF32()![shader.UNIFORM_OFFSET_F32.bpRangeX + 2]!
  }

  // Reversal is baked into bpRangeX's negated length (no separate reversed
  // uniform + shader flip). Forward -> positive length, reversed -> negative.
  test('forward block writes a positive bpRangeX length', () => {
    expect(bpRangeLen(false)).toBeGreaterThan(0)
  })
  test('reversed block writes a negated bpRangeX length', () => {
    expect(bpRangeLen(true)).toBeLessThan(0)
  })
})
