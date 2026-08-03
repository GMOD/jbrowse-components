// A rect whose start equals its end is an interbase POINT, not a box. Both the
// CRISPR guide glyph and the restriction-motif glyph synthesize one per cut
// (`glyphEmitters.ts`), because a blunt cut sits BETWEEN two bases — which is
// exactly what a zero-length interval means in the interbase coordinates the
// adapters emit (`guideUtils.ts`). Neither the guide nor the motif FEATURE is
// zero-length; only these derived marks are.
//
// The min-width clamp has to treat the two cases differently, and the split has
// to key on the genomic coords rather than on the snapped pixel width — pixel
// snapping collapses plenty of real sub-pixel spans onto one pixel, and
// centering those would slide every one of them off its start edge. That
// regression is what the second test guards.
import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'
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

// The only fillRect this region produces is the rect itself: no arrows, lines,
// or continuation markers are populated.
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

  // 800px showing bp 0..800, so 1 bp/px and bp N lands on x=N forward.
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
  drawFeatureBlocks(ctx, new Map([[0, region]]), [block], {
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

// Centering must not depend on the render axis: a point has no start edge to
// anchor, so reversing the block moves the mark's coordinate but not its
// relationship to it.
test('a cut-site point stays centered on a reversed block', () => {
  const { x, w } = drawnRect(400, 400, true)
  expect(w).toBe(MIN_RECT_WIDTH_PX)
  expect(x + w / 2).toBe(800 - 400)
})

// The regression the genomic-coords keying exists to prevent. 1bp at 1 bp/px is
// under the 2px floor and snaps to a single pixel, so a width-derived test would
// mistake it for a point and shift it left.
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
