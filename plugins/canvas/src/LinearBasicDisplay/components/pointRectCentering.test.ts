// A rect whose start equals its end is an interbase point, not a box: a blunt cut
// sits between two bases. The min-width clamp keys the two cases on the genomic
// coords rather than the snapped pixel width, since snapping collapses plenty of
// real sub-pixel spans onto one pixel and centering those would slide every one
// off its start edge.
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { CANVAS_FEATURE_MARKS } from '../marks/canvasFeatureMarks.ts'
import { MIN_RECT_WIDTH_PX } from './sharedRendererConstants.ts'

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

// The only fillRect this region produces is the rect itself.
function drawnRect(startBp: number, endBp: number, reversed = false) {
  let box: { x: number; w: number } | undefined
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    fillRect(x: number, _y: number, w: number) {
      box = { x, w }
    },
    strokeRect() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  } as unknown as Ctx2D

  // 800px showing bp 0..800, so bp N lands on x=N forward.
  const block: FeatureRenderBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 800,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed,
  }
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([startBp, endBp]),
    rectYs: new Float32Array([0]),
    rectHeights: new Float32Array([10]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([0]),
    rectDensityFade: new Uint32Array([0]),
  }
  paintMarkBlocks(ctx, CANVAS_FEATURE_MARKS, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 800,
    canvasHeight: 50,
  })
  if (!box) {
    throw new Error('no rect drawn')
  }
  return box
}

test('a cut-site point straddles its coordinate', () => {
  const { x, w } = drawnRect(400, 400)
  expect(w).toBe(MIN_RECT_WIDTH_PX)
  // The boundary the cut sits on is the mark's midpoint, not its left edge.
  expect(x + w / 2).toBe(400)
})

// A point has no start edge to anchor, so reversing the block moves the mark's
// coordinate but not its relationship to it.
test('a cut-site point stays centered on a reversed block', () => {
  const { x, w } = drawnRect(400, 400, true)
  expect(w).toBe(MIN_RECT_WIDTH_PX)
  expect(x + w / 2).toBe(800 - 400)
})

// 1bp at 1 bp/px is under the 2px floor and snaps to a single pixel, so a
// width-derived test would mistake it for a point and shift it left.
test('a sub-pixel real span still anchors on its start edge', () => {
  const { x, w } = drawnRect(400, 401)
  expect(w).toBe(MIN_RECT_WIDTH_PX)
  expect(x).toBe(400)
})

test('a span wider than the floor is unaffected', () => {
  const { x, w } = drawnRect(400, 450)
  expect(x).toBe(400)
  expect(w).toBe(50)
})
