import { pointMark } from './pointMark.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { PointChannels, PointParams } from './pointMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'

interface Region {
  span: SpanChannels
  point: PointChannels
}
interface State {
  canvasWidth: number
  canvasHeight: number
  span: SpanParams
  point: PointParams
}

const span = defineMark({
  shape: spanMark,
  channels: (d: Region) => d.span,
  params: (s: State) => s.span,
})

test('a mark drawing off another buffer must share its instance struct', () => {
  expect(
    defineMark({
      shape: spanMark,
      channels: (d: Region) => d.span,
      params: (s: State) => s.span,
      bufferOf: span,
    }).bufferOf,
  ).toBe('span')
  expect(() =>
    defineMark({
      shape: pointMark,
      channels: (d: Region) => d.point,
      params: (s: State) => s.point,
      bufferOf: span,
    }),
  ).toThrow(/point draws off span's buffer/)
})
