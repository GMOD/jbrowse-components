// The strand arrow draws outside the box it annotates, at a fixed 7px, so on a
// zoomed-out repeat track every arrow is wider than its feature and lands on the
// neighbour. A feature too narrow to be worth a direction marker gets none.
import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'
import { ARROW_MIN_FEATURE_WIDTH_PX } from './sharedRendererConstants.ts'

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

// The head is the only filled 3-point path this region produces, no rects or
// lines being populated.
function countArrowheads(region: RegionRenderData, reversed: boolean) {
  let heads = 0
  let points = 0
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    fillRect() {},
    stroke() {},
    beginPath() {
      points = 0
    },
    moveTo() {
      points++
    },
    lineTo() {
      points++
    },
    closePath() {},
    fill() {
      if (points === 3) {
        heads++
      }
    },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  } as unknown as Ctx2D

  // 100px showing bp 50..150, so a feature's bp length is its px width.
  const block: FeatureRenderBlock = {
    displayedRegionIndex: 0,
    start: 50,
    end: 150,
    screenStartPx: 0,
    screenEndPx: 100,
    reversed,
  }
  drawFeatureBlocks(ctx, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 100,
    canvasHeight: 50,
  })
  return heads
}

// `x` is the arrow's anchor: the feature's end on +, its start on -.
function arrowRegion(x: number, widthBp: number, strand: 1 | -1) {
  return {
    ...EMPTY,
    arrowXs: new Uint32Array([x]),
    arrowYs: new Float32Array([20]),
    arrowHeights: new Float32Array([10]),
    arrowWidthsBp: new Uint32Array([widthBp]),
    arrowDirections: new Int8Array([strand]),
    arrowColors: new Uint32Array([0xff_00_00_00]),
  } satisfies RegionRenderData
}

test('a feature wider than the threshold keeps its strand arrow', () => {
  const region = arrowRegion(100, ARROW_MIN_FEATURE_WIDTH_PX + 1, 1)
  expect(countArrowheads(region, false)).toBe(1)
  expect(countArrowheads(region, true)).toBe(1)
})

test('a feature narrower than the threshold draws no strand arrow', () => {
  const region = arrowRegion(100, ARROW_MIN_FEATURE_WIDTH_PX - 1, 1)
  expect(countArrowheads(region, false)).toBe(0)
  expect(countArrowheads(region, true)).toBe(0)
})

// On - strand `x` is the feature's start and the span runs the other way, so
// measuring off the wrong side sizes the feature from the block edge instead.
test('the gate measures the same feature on either strand', () => {
  const narrow = ARROW_MIN_FEATURE_WIDTH_PX - 1
  const wide = ARROW_MIN_FEATURE_WIDTH_PX + 1
  expect(countArrowheads(arrowRegion(100, narrow, -1), false)).toBe(0)
  expect(countArrowheads(arrowRegion(100, wide, -1), false)).toBe(1)
})
