import { SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG } from '../scoreScale.ts'
import { lineValueAtColorYPx } from '../shaders/lineCommon.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { normalizeScoreUnclamped } from '../shaders/scoreScale.js.generated.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { lineStepMark } from './lineMark.ts'

import type { LineChannels, LineParams } from './lineMark.ts'

// A line under a ramp over its own `y` reads the value at each fragment's
// color y back through the y scale (`lineFragmentColor`). The vertex places
// that y as `lineColorYPx` does: the band's top, plus the unclamped fraction
// down the band.

const PITCH = 40
const BAND = 32
const OFFSET = 4

test.each([
  ['linear', [0, 10] as [number, number], 0, [0.5, 3, 9.5]],
  ['log', [1, 1000] as [number, number], SCALE_TYPE_LOG, [2, 50, 900]],
  ['symlog', [-40, 60] as [number, number], SCALE_TYPE_SYMLOG, [-30, 0, 2, 55]],
])(
  '%s: a value placed in any row reads back as itself',
  (_, [min, max], type, values) => {
    for (const slot of [0, 1, 3]) {
      const bandTop = rowBandTopPx(OFFSET, PITCH, slot)
      for (const value of values) {
        const colorY =
          bandTop +
          (1 - normalizeScoreUnclamped(value, min, max, type, 1)) * BAND
        expect(
          lineValueAtColorYPx(colorY, bandTop, BAND, min, max, type, 1),
        ).toBeCloseTo(value, 3)
      }
    }
  },
)

const GRAY = Uint8Array.from({ length: 256 * 4 }, (_, i) =>
  i % 4 === 3 ? 255 : Math.floor(i / 4),
)
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}
const frame = { canvasWidth: 1000, canvasHeight: 100 }

function rise(y0: number, y1: number): LineChannels {
  const c: LineChannels = {
    x: Uint32Array.of(10, 20),
    x2: Uint32Array.of(20, 30),
    y: Float32Array.of(y0, y1),
    row: Uint32Array.of(0, 0),
    count: 2,
  }
  c.colorValue = c.y
  return c
}

function grays(c: LineChannels, params: LineParams) {
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, params)
  return new Set(
    calls.map(r => Number(/rgba\((\d+)/.exec(r.fillStyle as string)![1])),
  )
}

test('a line over a sliver of the ramp still steps through it finely', () => {
  const levels = grays(rise(40, 42), {
    domain: [40, 42],
    origin: 40,
    lineWidth: 2,
    colorScale: { domain: [0, 100], scale: 'linear', lut: GRAY },
    colorFromY: true,
  })
  expect(levels.size).toBeGreaterThan(4)
})

test('on a y domain with no range each instance keeps its own color, as the shader does', () => {
  const levels = grays(rise(2, 8), {
    domain: [5, 5],
    origin: 0,
    lineWidth: 2,
    colorScale: { domain: [0, 10], scale: 'linear', lut: GRAY },
    colorFromY: true,
  })
  // each instance's own value: 2 and 8 on a 0..10 gray ramp
  expect(levels).toEqual(new Set([51, 204]))
})
