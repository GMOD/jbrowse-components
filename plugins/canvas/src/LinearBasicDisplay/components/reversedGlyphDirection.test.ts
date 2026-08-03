// Every directional glyph the feature renderer draws — intron chevrons, strand
// arrows, continuation markers — is placed from a strand the worker packed, and
// the worker cannot know a block is reversed. So each one owes its direction a
// flip on the render side.
//
// Worth pinning here rather than leaving to the Canvas2D-vs-GPU parity gate:
// both backends read the same genomic field, so a missing flip is normally
// missing IDENTICALLY in both, and a differential gate sees two agreeing wrong
// answers. rectStrands shipped that way — a + gene's continuation markers
// pointed opposite the strand arrows on the same glyph, on flipped regions only.
//
// Each test populates exactly one glyph family so the recorded paths are
// unambiguous, and asserts the forward and reversed cases point opposite ways.
import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface Pt {
  x: number
  y: number
}

// Records paths, split on beginPath. Point counts identify the shape: 2 = intron
// line, 3 = a chevron or an arrowhead.
function recordingCtx() {
  const paths: Pt[][] = []
  let current: Pt[] = []
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    fillRect() {},
    closePath() {},
    stroke() {},
    fill() {},
    beginPath() {
      current = []
      paths.push(current)
    },
    moveTo(x: number, y: number) {
      current.push({ x, y })
    },
    lineTo(x: number, y: number) {
      current.push({ x, y })
    },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  }
  return {
    ctx: ctx as unknown as Ctx2D,
    triangles: () => paths.filter(p => p.length === 3),
  }
}

const EMPTY: RegionRenderData = {
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
}

// A 100px-wide canvas showing bp 50..150. Forward maps bp→(bp-50), reversed maps
// bp→(150-bp), so the same feature runs the opposite way on screen.
function draw(region: RegionRenderData, reversed: boolean) {
  const { ctx, triangles } = recordingCtx()
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
  return triangles()
}

// Chevron: moveTo(base) → lineTo(apex) → lineTo(base), so the apex is the middle
// point and the two base corners share an x. Returns apex-minus-base per chevron
// — positive points right, negative left.
function chevronApexOffsets(region: RegionRenderData, reversed: boolean) {
  return draw(region, reversed).map(([base, apex, back]) => {
    expect(base!.x).toBeCloseTo(back!.x)
    return apex!.x - base!.x
  })
}

test('intron chevrons follow the screen axis', () => {
  // 80px of intron hosts two chevrons at the 40px nominal spacing.
  const region: RegionRenderData = {
    ...EMPTY,
    linePositions: new Uint32Array([60, 140]),
    lineYs: new Float32Array([20]),
    lineHeights: new Float32Array([10]),
    lineColors: new Uint32Array([0xff_00_00_00]),
    lineDirections: new Int8Array([1]),
  }
  const forward = chevronApexOffsets(region, false)
  expect(forward.length).toBe(2)
  for (const d of forward) {
    expect(d).toBeGreaterThan(0)
  }
  const flipped = chevronApexOffsets(region, true)
  expect(flipped.length).toBe(2)
  for (const d of flipped) {
    expect(d).toBeLessThan(0)
  }
})

test('strand arrowheads follow the screen axis', () => {
  const region: RegionRenderData = {
    ...EMPTY,
    arrowXs: new Uint32Array([100]),
    arrowYs: new Float32Array([20]),
    arrowHeights: new Float32Array([10]),
    // bp 60..100, i.e. 40px at this block's 1 bp/px — comfortably past the
    // narrow-feature gate, which the next test covers.
    arrowWidthsBp: new Uint32Array([40]),
    arrowDirections: new Int8Array([1]),
    arrowColors: new Uint32Array([0xff_00_00_00]),
  }
  // The head is moveTo(stemEnd, top) → lineTo(stemEnd, bottom) → lineTo(tip), so
  // its first two points share an x and the third is the tip.
  const tipOffset = (reversed: boolean) => {
    const [head] = draw(region, reversed)
    const [back, backAgain, tip] = head!
    expect(back!.x).toBeCloseTo(backAgain!.x)
    return tip!.x - back!.x
  }
  expect(tipOffset(false)).toBeGreaterThan(0)
  expect(tipOffset(true)).toBeLessThan(0)
})

test('continuation markers follow the screen axis', () => {
  // Spans bp 20..100: forward it runs off the left edge, reversed off the right,
  // in both cases by more than CONT_MIN_OVERHANG_PX while staying in view.
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([20, 100]),
    rectYs: new Float32Array([0]),
    rectHeights: new Float32Array([10]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([1]),
    rectDensityFade: new Uint32Array([0]),
  }
  // Two chevrons make the "»", both pointing the same way.
  const forward = chevronApexOffsets(region, false)
  expect(forward.length).toBe(2)
  for (const d of forward) {
    expect(d).toBeGreaterThan(0)
  }
  const flipped = chevronApexOffsets(region, true)
  expect(flipped.length).toBe(2)
  for (const d of flipped) {
    expect(d).toBeLessThan(0)
  }
})

// A strand-less feature has no direction to flip, so its markers point outward
// from whichever edge they sit on, both ways round. flipX(0) is 0 — which is
// exactly why the reversed-region SVG export snapshot, whose features are
// strand-less, could not see the bug.
test('strand-less continuation markers point outward regardless of orientation', () => {
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([20, 100]),
    rectYs: new Float32Array([0]),
    rectHeights: new Float32Array([10]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([0]),
    rectDensityFade: new Uint32Array([0]),
  }
  // Forward the feature leaves by the left edge, reversed by the right, so
  // "outward" is left then right.
  for (const d of chevronApexOffsets(region, false)) {
    expect(d).toBeLessThan(0)
  }
  for (const d of chevronApexOffsets(region, true)) {
    expect(d).toBeGreaterThan(0)
  }
})
