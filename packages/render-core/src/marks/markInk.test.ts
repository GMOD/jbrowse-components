import { inkOfInstances } from './markInk.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkFrame } from './types.ts'

interface State extends MarkFrame {
  span: SpanParams
  on: boolean
  bandHeight: number
}

// 100 bp over 100 px from x 50: instance 0 crosses the block's left edge,
// instance 1 sits on row 1, instance 2 on row 3 below a 25 px band.
const region: SpanChannels = {
  x: Uint32Array.from([0, 30, 60]),
  x2: Uint32Array.from([20, 40, 70]),
  row: Uint32Array.from([0, 1, 3]),
  color: Uint32Array.from([1, 2, 3]),
  count: 3,
}

const blocks = [
  {
    displayedRegionIndex: 0,
    start: 10,
    end: 110,
    screenStartPx: 50,
    screenEndPx: 150,
    reversed: false,
  },
]

const state = (over: Partial<State> = {}): State => ({
  canvasWidth: 200,
  canvasHeight: 80,
  span: {
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
  },
  on: true,
  bandHeight: 25,
  ...over,
})

const plain = defineMark({
  shape: spanMark,
  channels: (r: SpanChannels) => r,
  params: (s: State) => s.span,
  enabled: s => s.on,
})

const banded = defineMark({
  shape: spanMark,
  channels: (r: SpanChannels) => r,
  params: (s: State) => s.span,
  band: s => ({ top: 0, height: s.bandHeight }),
})

const walk = (marks: (typeof plain)[], s: State, indices: number[]) =>
  inkOfInstances(
    marks,
    blocks,
    () => region,
    s,
    () => indices.map(index => ({ mark: 0, index })),
  )

test('an instance box is the span the painter fills, clipped to the block column', () => {
  expect(walk([plain], state(), [1, 0])).toEqual([
    { left: 70, top: 10, width: 10, height: 10 },
    { left: 50, top: 0, width: 10, height: 10 },
  ])
})

test('a disabled mark and a region the walk does not name draw nothing', () => {
  expect(walk([plain], state({ on: false }), [1])).toEqual([])
  expect(
    inkOfInstances(
      [plain],
      blocks,
      () => region,
      state(),
      () => undefined,
    ),
  ).toEqual([])
})

test('a band clips the box the way it clips the paint, to nothing past it', () => {
  expect(walk([banded], state(), [2])).toEqual([])
  expect(walk([banded], state({ bandHeight: 35 }), [2])).toEqual([
    { left: 100, top: 30, width: 10, height: 5 },
  ])
  expect(walk([banded], state({ bandHeight: 0 }), [1])).toEqual([])
})

test('the derived hit test answers the box, on top first', () => {
  const s = state()
  const hit = plain.hitNearest!(region, blocks[0]!, s, 75, 15, [2, 1, 0], 0.5)
  expect(hit).toMatchObject({ index: 1, distSq: 0 })
  expect(
    plain.hitNearest!(region, blocks[0]!, s, 75, 25, [2, 1, 0], 0.5),
  ).toBeUndefined()
})
