// A 1px intron line can only sit on a whole pixel row, which a box spanning an
// even number of rows does not have. At the 2px bodies fit mode squeezes down to
// that half-pixel is half the box, so thin boxes draw at an odd height and these
// pin the symmetry it buys.
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { CANVAS_FEATURE_MARKS } from '../marks/canvasFeatureMarks.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const EMPTY = {
  rectPositions: new Uint32Array(),
  rectYs: new Float32Array(),
  rectHeights: new Float32Array(),
  rectColors: new Uint32Array(),
  rectStrands: new Float32Array(),
  rectDensityFade: new Uint32Array(),
  outlineColor: 0,
  linePositions: new Uint32Array(),
  lineYs: new Float32Array(),
  lineHeights: new Float32Array(),
  lineColors: new Uint32Array(),
  lineDirections: new Int8Array(),
  arrowXs: new Uint32Array(),
  arrowYs: new Float32Array(),
  arrowHeights: new Float32Array(),
  arrowWidthsBp: new Uint32Array(),
  arrowDirections: new Int8Array(),
  arrowColors: new Uint32Array(),
} satisfies RegionRenderData

// One exon box and the intron line running off its right edge, at the same row
// top and body height, the line's y being the box's real center.
function drawTranscript(heightPx: number, topY: number) {
  let box: { y: number; h: number } | undefined
  let lineY: number | undefined
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    beginPath() {},
    moveTo(_x: number, y: number) {
      lineY = y
    },
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    fillRect(_x: number, y: number, _w: number, h: number) {
      box = { y, h }
    },
    strokeRect() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  } as unknown as Ctx2D

  const block: FeatureRenderBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 800,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([100, 200]),
    rectYs: new Float32Array([topY]),
    rectHeights: new Float32Array([heightPx]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([0]),
    rectDensityFade: new Uint32Array([0]),
    linePositions: new Uint32Array([200, 400]),
    lineYs: new Float32Array([topY + heightPx / 2]),
    lineHeights: new Float32Array([heightPx]),
    lineColors: new Uint32Array([0xff_00_00_00]),
    // No chevrons, so moveTo fires once, for the line itself.
    lineDirections: new Int8Array([0]),
  }
  paintMarkBlocks(ctx, CANVAS_FEATURE_MARKS, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 800,
    canvasHeight: 50,
  })
  if (!box || lineY === undefined) {
    throw new Error('expected a box and a line')
  }
  // The stroke covers the pixel row below its y, so that row's top is lineY-0.5.
  const lineTop = lineY - 0.5
  return {
    boxHeight: box.h,
    above: lineTop - box.y,
    below: box.y + box.h - (lineTop + 1),
  }
}

// 2px is what a fit-mode squeeze floors at.
test.each([2, 3, 4, 5])(
  'a %ipx transcript body centers its intron line',
  heightPx => {
    const { above, below } = drawTranscript(heightPx, 20)
    expect(above).toBe(below)
  },
)

test('a thin even body is drawn one pixel taller so it has a center row', () => {
  expect(drawTranscript(2, 20).boxHeight).toBe(3)
  expect(drawTranscript(4, 20).boxHeight).toBe(5)
})

test('odd and full-size bodies keep the height they were laid out at', () => {
  expect(drawTranscript(3, 20).boxHeight).toBe(3)
  expect(drawTranscript(5, 20).boxHeight).toBe(5)
  expect(drawTranscript(10, 20).boxHeight).toBe(10)
})

// The nudge is about the box's own rows, and a fit scale puts row tops on
// fractional pixels.
test('centering holds at a fractional row top', () => {
  const { above, below } = drawTranscript(2, 20.4)
  expect(above).toBe(below)
})
