import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// strokeChevron is the only thing in drawFeatureBlocks that emits a path, given
// a region with no intron lines, no strand arrows and no rect outline — so the
// recorded moveTo/lineTo pairs are exactly the continuation markers.
function recordingCtx() {
  const moves: { x: number; y: number }[] = []
  const lines: { x: number; y: number }[] = []
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    stroke() {},
    fill() {},
    closePath() {},
    fillRect() {},
    moveTo(x: number, y: number) {
      moves.push({ x, y })
    },
    lineTo(x: number, y: number) {
      lines.push({ x, y })
    },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  }
  return { ctx: ctx as unknown as Ctx2D, moves, lines }
}

// One rect, spanning bp 20..100 with genomic strand +1, no lines/arrows/outline.
function makeRegion(): RegionRenderData {
  return {
    rectPositions: new Uint32Array([20, 100]),
    rectYs: new Float32Array([0]),
    rectHeights: new Float32Array([10]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([1]),
    rectDensityFade: new Uint32Array([0]),
    outlineColor: 0,
    linePositions: new Uint32Array(),
    lineYs: new Float32Array(),
    lineHeights: new Float32Array(),
    lineColors: new Uint32Array(),
    lineDirections: new Int8Array(),
    arrowXs: new Uint32Array(),
    arrowYs: new Float32Array(),
    arrowHeights: new Float32Array(),
    arrowDirections: new Int8Array(),
    arrowColors: new Uint32Array(),
  }
}

// A 100px-wide canvas showing bp 50..150, so the rect's bp 20 end lies well past
// one screen edge (further than CONT_MIN_OVERHANG_PX) while bp 100 stays in view.
// Forward that edge is the left one, reversed it is the right one.
function drawMarkers(reversed: boolean) {
  const { ctx, moves, lines } = recordingCtx()
  const block: FeatureRenderBlock = {
    displayedRegionIndex: 0,
    start: 50,
    end: 150,
    screenStartPx: 0,
    screenEndPx: 100,
    reversed,
  }
  drawFeatureBlocks(ctx, new Map([[0, makeRegion()]]), [block], {
    scrollY: 0,
    canvasWidth: 100,
    canvasHeight: 50,
  })
  // Each marker is moveTo(base) → lineTo(apex) → lineTo(base); pair them up.
  return moves.map((base, i) => ({ baseX: base.x, apexX: lines[i * 2]!.x }))
}

test('forward block: a + feature running off the left edge points its markers right', () => {
  const markers = drawMarkers(false)
  // Two chevrons make the "»", both pointing the same way.
  expect(markers.length).toBe(2)
  for (const { baseX, apexX } of markers) {
    expect(apexX).toBeGreaterThan(baseX)
  }
})

test('reversed block: the same + feature points its markers left, following the flipped axis', () => {
  const markers = drawMarkers(true)
  expect(markers.length).toBe(2)
  for (const { baseX, apexX } of markers) {
    expect(apexX).toBeLessThan(baseX)
  }
})
