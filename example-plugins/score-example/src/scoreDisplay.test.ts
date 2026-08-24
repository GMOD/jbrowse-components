import { SimpleFeature } from '@jbrowse/core/util'
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'

import {
  buildScoreResult,
  drawScoreBlocks,
  fetchScoreData,
  scoreGpu,
} from './scoreDisplay.ts'
import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData, ScoreRenderState } from './scoreDisplay.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function feature(uniqueId: string, start: number, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end: start + 10,
    score,
  })
}

function data(
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

const state: ScoreRenderState = {
  canvasWidth: 1000,
  canvasHeight: 100,
  params: { color: '#0068d1', scoreColumn: 'score' },
}

const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

describe('buildScoreResult', () => {
  test('flattens features into parallel typed arrays at matching indexes', () => {
    const r = buildScoreResult(
      [feature('a', 10, 2), feature('b', 200, 4), feature('c', 3000, 1)],
      'score',
    )
    expect(r.numFeatures).toBe(3)
    expect(Array.from(r.starts)).toEqual([10, 200, 3000])
    expect(Array.from(r.ends)).toEqual([20, 210, 3010])
  })

  test('normalizes score to 0..1 against the region max', () => {
    const r = buildScoreResult(
      [feature('a', 0, 5), feature('b', 100, 10)],
      'score',
    )
    expect(Array.from(r.scores)).toEqual([0.5, 1])
  })

  test('drops features with a non-finite score, keeping arrays dense', () => {
    const r = buildScoreResult(
      [feature('a', 10, 3), feature('scoreless', 50), feature('c', 3000, 6)],
      'score',
    )
    expect(r.numFeatures).toBe(2)
    expect(Array.from(r.starts)).toEqual([10, 3000])
  })

  test('preserves uint32 positions above the float32-safe range', () => {
    const bigPos = 250_000_001
    const r = buildScoreResult([feature('big', bigPos, 1)], 'score')
    expect(r.starts[0]).toBe(bigPos)
  })
})

describe('fetchScoreData', () => {
  // The adapter is what knows when it is downloading and what can stop
  // mid-fetch, so both handles have to reach it rather than be consumed here.
  // Both are optional on the adapter side, so dropping either compiles.
  test('the status callback and stop token reach the adapter', async () => {
    const getFeaturesArray = jest.fn().mockResolvedValue([feature('f1', 0, 5)])
    const statusCallback = jest.fn()
    const adapter = { getFeaturesArray } as unknown as BaseFeatureDataAdapter
    const result = await fetchScoreData({
      adapter,
      region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      params: { scoreColumn: 'score' },
      stopToken: 'token-1',
      statusCallback,
    })
    expect(result.numFeatures).toBe(1)
    const opts = getFeaturesArray.mock.calls[0]![1]
    expect(opts.statusCallback).toBe(statusCallback)
    expect(opts.stopToken).toBe('token-1')
    expect(statusCallback).toHaveBeenCalledWith('Fetching features')
  })
})

describe('drawScoreBlocks', () => {
  function mockCtx() {
    const rects: [number, number, number, number][] = []
    const ctx = {
      fillStyle: '',
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push([x, y, w, h])
      },
    }
    return { ctx: ctx as unknown as Ctx2D, rects }
  }

  test('draws one box per feature, height proportional to score', () => {
    const { ctx, rects } = mockCtx()
    drawScoreBlocks(
      ctx,
      new Map([[0, data([100], [200], [0.5])]]),
      [block],
      state,
    )
    expect(rects).toHaveLength(1)
    const [x, y, w, h] = rects[0]!
    expect(x).toBeCloseTo(100)
    expect(w).toBeCloseTo(100)
    expect(h).toBeCloseTo(50)
    expect(y).toBeCloseTo(50)
  })

  test('draws nothing for a region with no fetched data', () => {
    const { ctx, rects } = mockCtx()
    drawScoreBlocks(ctx, new Map(), [block], state)
    expect(rects).toHaveLength(0)
  })

  test('widens a sub-pixel feature to at least 1px so it still paints', () => {
    const { ctx, rects } = mockCtx()
    drawScoreBlocks(
      ctx,
      new Map([[0, data([500], [500], [1])]]),
      [block],
      state,
    )
    expect(rects[0]![2]).toBe(1)
  })
})

describe('scoreGpu', () => {
  test('packs startBp / endBp / score at the offsets the shader expects', () => {
    const d = data([42, 1337], [99, 2000], [0.5, 0.25])
    const buf = shader.packInstances(
      { startBp: d.starts, endBp: d.ends, score: d.scores },
      d.numFeatures,
    )
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    const stride = shader.INSTANCE_STRIDE_WORDS
    expect(u32[shader.INSTANCE_OFFSET_U32.startBp]).toBe(42)
    expect(u32[shader.INSTANCE_OFFSET_U32.endBp]).toBe(99)
    expect(f32[shader.INSTANCE_OFFSET_F32.score]).toBeCloseTo(0.5)
    expect(u32[stride + shader.INSTANCE_OFFSET_U32.startBp]).toBe(1337)
    expect(u32[stride + shader.INSTANCE_OFFSET_U32.endBp]).toBe(2000)
    expect(f32[stride + shader.INSTANCE_OFFSET_F32.score]).toBeCloseTo(0.25)
    expect(buf.byteLength).toBe(2 * shader.INSTANCE_STRIDE_BYTES)
    expect(scoreGpu.passes[0]!.pack(d).byteLength).toBe(buf.byteLength)
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
    expect(new Uint32Array(buf)[shader.INSTANCE_OFFSET_U32.startBp]).toBe(
      bigPos,
    )
  })

  // Reversal is baked into bpRangeX's negated length (no separate reversed
  // uniform + shader flip): forward -> positive length, reversed -> negative.
  function bpRangeLen(reversed: boolean) {
    const b = { ...block, screenEndPx: 800, reversed }
    const clip = clipBlock(b, 800, 100, { x: 1, y: 1 })!
    return scoreGpu.uniforms(b, clip, data([500], [600], [0.5]), {
      ...state,
      canvasWidth: 800,
    }).bpRangeX[2]
  }

  test('forward block writes a positive bpRangeX length', () => {
    expect(bpRangeLen(false)).toBeGreaterThan(0)
  })

  test('reversed block writes a negated bpRangeX length', () => {
    expect(bpRangeLen(true)).toBeLessThan(0)
  })
})
