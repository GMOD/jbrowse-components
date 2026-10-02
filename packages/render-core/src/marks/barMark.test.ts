import { barMark } from './barMark.ts'
import { recordingContext } from './drawAgainstHit.ts'

import type { BarChannels, BarParams } from './barMark.ts'

const frame = { canvasWidth: 1000, canvasHeight: 120 }

const params: BarParams = {
  domain: [0, 1],
  origin: 0,
  minWidthPx: 0,
  seamPx: 0.8,
}

// Clipped above the domain, so the bar paints its clip strip too.
const clippedBar: BarChannels = {
  x: Uint32Array.from([10]),
  x2: Uint32Array.from([40]),
  y: Float32Array.from([2]),
  color: Uint32Array.from([0xff0000ff]),
  row: Uint32Array.from([0]),
  count: 1,
}

function paintedXs(reversed: boolean) {
  const { ctx, calls } = recordingContext()
  barMark.paintBlock(
    ctx,
    clippedBar,
    {
      displayedRegionIndex: 0,
      start: 0,
      end: 100,
      screenStartPx: 0,
      screenEndPx: 1000,
      reversed,
    },
    frame,
    params,
  )
  return calls.map(c => [c.x, c.w])
}

// Instances paint in ascending bp, so the seam goes past the bp-end edge onto
// the next bar painted: right on a forward block, left on a reversed one.
test('the seam pad on a bar and its clip strip reaches toward the next bar painted', () => {
  expect(paintedXs(false)).toEqual([
    [100, 300.8],
    [100, 300.8],
  ])
  expect(paintedXs(true)).toEqual([
    [599.2, 300.8],
    [599.2, 300.8],
  ])
})
