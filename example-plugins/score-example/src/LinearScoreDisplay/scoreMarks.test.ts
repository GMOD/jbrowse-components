import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { findScoreHit } from './findScoreHit.ts'
import { SCORE_MARKS } from './scoreMarks.ts'
import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreMarks.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const MARK = SCORE_MARKS[0]!

const BLUE = 0xffd16800

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

const state: ScoreRenderState = {
  canvasWidth: 1000,
  canvasHeight: 100,
  color: BLUE,
}

// 1bp == 1px
const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

function paint(data: ScoreRegionData, b = block) {
  const { ctx, calls } = recordingContext()
  MARK.paintBlock(ctx, data, b, state)
  return calls
}

// The declaration's own claim: which of the payload's arrays reach which of
// the shape's lanes. A lane swap packs a valid buffer that draws the wrong
// picture, which no shader-side test can see.
test('the declaration feeds starts/ends/scores to startBp/endBp/score', () => {
  const buf = MARK.pass.pack(mkData([42, 1337], [99, 2000], [0.5, 0.25]))
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const f32 = new Float32Array(buf as ArrayBuffer)
  const stride = shader.INSTANCE_STRIDE_WORDS

  expect(buf.byteLength).toBe(2 * shader.INSTANCE_STRIDE_BYTES)
  expect(u32[shader.INSTANCE_OFFSET_U32.startBp]).toBe(42)
  expect(u32[shader.INSTANCE_OFFSET_U32.endBp]).toBe(99)
  expect(f32[shader.INSTANCE_OFFSET_F32.score]).toBeCloseTo(0.5)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.startBp]).toBe(1337)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.endBp]).toBe(2000)
  expect(f32[stride + shader.INSTANCE_OFFSET_F32.score]).toBeCloseTo(0.25)
})

test('preserves uint32 positions above the float32-safe range', () => {
  const bigPos = 250_000_001
  const buf = MARK.pass.pack(mkData([bigPos], [bigPos + 1], [1]))
  expect(
    new Uint32Array(buf as ArrayBuffer)[shader.INSTANCE_OFFSET_U32.startBp],
  ).toBe(bigPos)
})

describe('uniforms', () => {
  function uniformsFor(b: RenderBlock) {
    const hal = new MockHal([MARK.pass])
    const scratch = new ArrayBuffer(MARK.pass.uniformByteSize)
    const clip = clipBlock(b, state.canvasWidth, state.canvasHeight, {
      x: 1,
      y: 1,
    })!
    MARK.drawRegion(
      hal,
      scratch,
      b,
      clip,
      mkData([500], [600], [0.5]),
      state,
      b.displayedRegionIndex,
    )
    return { f32: hal.getLastUniformsF32()!, u32: hal.getLastUniformsU32()! }
  }

  // Reversal is baked into bpRangeX's negated length rather than a separate
  // flag the shader flips on. Forward -> positive, reversed -> negative.
  test('a reversed block writes a negated bpRangeX length', () => {
    const forward = uniformsFor(block).f32
    const reversed = uniformsFor({ ...block, reversed: true }).f32
    expect(forward[shader.UNIFORM_OFFSET_F32.bpRangeX + 2]).toBeGreaterThan(0)
    expect(reversed[shader.UNIFORM_OFFSET_F32.bpRangeX + 2]).toBeLessThan(0)
  })

  // The min-width floor divides by the width clip space spans, which is the
  // block column and not the canvas
  test('carries the block column width, the frame and the colour', () => {
    const { f32, u32 } = uniformsFor({
      ...block,
      screenStartPx: 400,
      screenEndPx: 800,
    })
    expect(f32[shader.UNIFORM_OFFSET_F32.viewportWidth]).toBe(400)
    expect(f32[shader.UNIFORM_OFFSET_F32.canvasHeight]).toBe(100)
    expect(u32[shader.UNIFORM_OFFSET_U32.color]).toBe(BLUE)
  })
})

describe('painter', () => {
  test('draws one box per feature, grown up from the bottom to its score', () => {
    expect(paint(mkData([100], [200], [0.5]))).toEqual([
      { x: 100, y: 50, w: 100, h: 50, fillStyle: 'rgba(0,104,209,1)' },
    ])
  })

  test('a block whose region has not landed paints nothing', () => {
    const { ctx, calls } = recordingContext()
    paintMarkBlocks(ctx, SCORE_MARKS, new Map(), [block], state)
    expect(calls).toEqual([])
  })

  test('widens a sub-pixel feature to the floor the shader uses', () => {
    expect(paint(mkData([500], [500], [1]))[0]!.w).toBe(shader.MIN_WIDTH_PX)
  })

  test('a reversed block mirrors the box to the opposite edge', () => {
    expect(
      paint(mkData([100], [200], [0.5]), { ...block, reversed: true })[0],
    ).toMatchObject({ x: 800, w: 100 })
  })
})

describe('hit', () => {
  const regions = new Map([[0, mkData([100, 500], [200, 501], [0.5, 1])]])

  test('a cursor inside a box answers it, at the ink under the cursor', () => {
    expect(findScoreHit(150, 75, [block], regions, state)).toEqual({
      start: 100,
      end: 200,
      score: 0.5,
      x: 150,
      y: 75,
    })
  })

  test('a cursor above a box, where nothing was painted, answers nothing', () => {
    expect(findScoreHit(150, 20, [block], regions, state)).toBeUndefined()
  })

  test('a 1px box is reachable from within the grab radius', () => {
    expect(findScoreHit(503, 50, [block], regions, state)).toMatchObject({
      start: 500,
      x: 501,
    })
  })
})
