import { SMALL_POINT_MAX_DIAMETER_PX, appendPointMarker } from './pointMarker.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function createMockCtx() {
  const rectCalls: [number, number, number, number][] = []
  const arcCalls: [number, number, number][] = []
  const moveToCalls: [number, number][] = []
  const ctx = {
    rect: jest.fn((x: number, y: number, w: number, h: number) => {
      rectCalls.push([x, y, w, h])
    }),
    arc: jest.fn((x: number, y: number, r: number) => {
      arcCalls.push([x, y, r])
    }),
    moveTo: jest.fn((x: number, y: number) => {
      moveToCalls.push([x, y])
    }),
  } as unknown as Ctx2D
  return { ctx, rectCalls, arcCalls, moveToCalls }
}

describe('appendPointMarker', () => {
  test('small point snaps the square top-left to the pixel grid', () => {
    const { ctx, rectCalls, arcCalls } = createMockCtx()
    // radius 1; top-left = floor(10.3 - 1 + 0.5), floor(5.7 - 1 + 0.5) = (9, 5)
    appendPointMarker(ctx, 10.3, 5.7, 2)
    expect(rectCalls).toEqual([[9, 5, 2, 2]])
    expect(arcCalls).toHaveLength(0)
  })

  test('snap rounds half up and keeps integer centers put', () => {
    const { ctx, rectCalls } = createMockCtx()
    // radius 1; floor(10 - 1 + 0.5) = floor(9.5) = 9
    appendPointMarker(ctx, 10, 10, 2)
    expect(rectCalls).toEqual([[9, 9, 2, 2]])
  })

  test('at the small/large threshold it still draws a snapped square', () => {
    const { ctx, rectCalls, arcCalls } = createMockCtx()
    // radius 1.5; floor(10 - 1.5 + 0.5) = floor(9) = 9
    appendPointMarker(ctx, 10, 10, SMALL_POINT_MAX_DIAMETER_PX)
    expect(rectCalls).toEqual([[9, 9, 3, 3]])
    expect(arcCalls).toHaveLength(0)
  })

  test('large point draws an unsnapped disc centered on the point', () => {
    const { ctx, rectCalls, arcCalls, moveToCalls } = createMockCtx()
    appendPointMarker(ctx, 10.3, 5.7, 4)
    expect(rectCalls).toHaveLength(0)
    expect(moveToCalls).toEqual([[12.3, 5.7]])
    expect(arcCalls).toEqual([[10.3, 5.7, 2]])
  })
})
