import {
  MIN_OFFSCREEN_MATE_WIDTH_PX,
  OFFSCREEN_MATE_HEIGHT_PX,
  drawOffscreenMates,
} from './drawOffscreenMates.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function fakeCtx() {
  const rects: Rect[] = []
  return {
    rects,
    ctx: {
      fillStyle: '',
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ x, y, w, h })
      },
    } as unknown as CanvasRenderingContext2D,
  }
}

function data(spans: [number, number][]): OffscreenMateData {
  return {
    mateRefNameDict: ['other'],
    counts: Uint32Array.from([spans.length]),
    starts: Float64Array.from(spans.map(s => s[0])),
    ends: Float64Array.from(spans.map(s => s[1])),
    mateRefNameIds: Uint32Array.from(spans.map(() => 0)),
  }
}

const params = {
  bpPerPx: 10,
  offsetPx: 0,
  width: 100,
  height: 50,
  color: 'red',
}

test('a stub sits on the query axis at the alignment position', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 400]]) })
  expect(rects).toEqual([{ x: 10, y: 0, w: 30, h: OFFSCREEN_MATE_HEIGHT_PX }])
})

// The whole risk in the feature: a mark spanning the band asserts an alignment
// to whatever sits directly under it, which is what these do NOT know.
test('a stub stops well short of the far row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 400]]) })
  expect(rects[0]!.h).toBeLessThan(params.height / 2)
})

test('and takes at most a third of a band too short for its full height', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    height: 9,
    data: data([[100, 400]]),
  })
  expect(rects[0]!.h).toBe(3)
})

test('the pan offset moves it, as it moves a ribbon', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    offsetPx: 5,
    data: data([[100, 400]]),
  })
  expect(rects[0]!.x).toBe(5)
})

test('a sub-pixel alignment is still a mark', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 101]]) })
  expect(rects[0]!.w).toBe(MIN_OFFSCREEN_MATE_WIDTH_PX)
})

test('one off each side of the window is skipped, the one between is not', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    data: data([
      [0, 50],
      [400, 500],
      [20000, 20100],
    ]),
  })
  expect(rects).toHaveLength(2)
  expect(rects.map(r => r.x)).toEqual([0, 40])
})

test('nothing to say draws nothing', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([]) })
  expect(rects).toHaveLength(0)
})

test('a collapsed band draws nothing rather than a zero-height row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, height: 0, data: data([[100, 400]]) })
  expect(rects).toHaveLength(0)
})
