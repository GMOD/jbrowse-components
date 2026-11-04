import { makeTestRenderState } from '../LinearAlignmentsDisplay/testUtils.ts'
import { GAP_SKIP } from '../shaders/slang/gap.consts.generated.ts'
import { SKIP_MARK } from './gap/mark.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 1100,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

function recordingCtx() {
  const fills: { y: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    fillRect(_x: number, y: number, _w: number, h: number) {
      fills.push({ y, h })
    },
  } as unknown as Ctx2D
  return { ctx, fills }
}

// The pixel row an intron centerline paints on `row`, as its Canvas2D painter
// draws it.
function intronRow(featureHeight: number, scrollTop: number, row: number) {
  const state = makeTestRenderState({
    featureHeight,
    featureSpacing: 0,
    scrollTop,
    pileupTopOffset: 20,
    canvasHeight: 1000,
    unit: 'chain',
  })
  const { ctx, fills } = recordingCtx()
  SKIP_MARK.paintBlock(
    ctx,
    {
      gapPositions: new Uint32Array([1010, 1050]),
      gapYs: new Uint16Array([row]),
      gapTypes: new Uint8Array([GAP_SKIP]),
      gapFrequencies: new Uint8Array([255]),
    },
    BLOCK,
    state,
  )
  return fills[0]!
}

// Fit mode squeezes reads to fractional heights and a scroll can land between
// pixels, so a row's centre is rarely on a pixel boundary. The centerline is
// one whole pixel row, the row holding the centre.
describe.each([
  [2.6, 0],
  [3.3, 0],
  [1, 0.25],
  [4.4, 13.4],
  [5.25, 0.5],
  [7, 0],
])('feature height %p, scroll %p', (featureHeight, scrollTop) => {
  test.each([0, 1, 7])('row %p', row => {
    const intron = intronRow(featureHeight, scrollTop, row)
    const centre = 20 + row * featureHeight - scrollTop + featureHeight / 2
    expect(intron.h).toBe(1)
    expect(intron.y).toBe(Math.floor(centre))
  })
})

// An even height centres a row on the seam between two pixel rows; the line
// takes the lower one, as render-core's `snapBoxCenterYPx` does for every
// feature's intron line.
test('an even height puts the centerline on the lower middle row', () => {
  expect(intronRow(4, 0, 0).y).toBe(22)
})
