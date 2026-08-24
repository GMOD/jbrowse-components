import { drawScoreBlocks } from './drawScore.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Minimal Ctx2D spy: records fillRect calls and swallows the clip/state calls.
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

const state: ScoreRenderState = {
  canvasWidth: 1000,
  canvasHeight: 100,
  color: '#0068d1',
}

const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
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

test('draws one box per feature, height proportional to score', () => {
  const { ctx, rects } = mockCtx()
  drawScoreBlocks(
    ctx,
    new Map([[0, data([100], [200], [0.5])]]),
    [block],
    state,
  )
  expect(rects).toHaveLength(1)
  // 1bp == 1px here (1000bp across 1000px), so the box spans x 100..200
  const [x, y, w, h] = rects[0]!
  expect(x).toBeCloseTo(100)
  expect(w).toBeCloseTo(100)
  // score 0.5 -> half the 100px canvas, grown up from the bottom
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
  // a 0-width feature (start == end) would otherwise draw nothing
  drawScoreBlocks(ctx, new Map([[0, data([500], [500], [1])]]), [block], state)
  expect(rects[0]![2]).toBe(1)
})
