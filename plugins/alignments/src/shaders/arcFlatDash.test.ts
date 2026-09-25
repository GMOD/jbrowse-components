import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { arcMarkFrom } from '../features/arcs/mark.ts'
import { ARC_SHAPE_FLAT_SPLIT } from '../features/arcs/shapes.ts'
import {
  ARC_FLAT_DASH_PX,
  ARC_FLAT_GAP_PX,
} from './slang/arcFlat.consts.generated.ts'
import * as glsl from './slang/arcFlat.glsl.generated.ts'
import { arcDashCoordPx } from './slang/arcFlat.js.generated.ts'
import * as wgsl from './slang/arcFlat.wgsl.generated.ts'

import type { ArcBandFrame } from '../features/arcs/mark.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

/**
 * Where a split-read connector's dash pattern starts.
 *
 * Canvas2D strokes the line `moveTo(mid - halfPx)` -> `lineTo(mid + halfPx)`
 * and SVG writes those same two points, so both begin the pattern at the
 * line's SCREEN-LEFT end and it rides with the line. The GPU pass dashed off
 * the fragment's band x instead, and a single-region view puts the block's
 * origin on screen x 0 and leaves it there — so the pattern stood still while
 * the line moved under it.
 */

const VIEW_W = 800
// A region four times the viewport, so a pan slides the block under a scissor
// that stays at screen x 0 — which is what pins the old origin to the screen.
const REGION_BP = 5000
const BLOCK_W = 4000
const X1 = 1_000_200
const X2 = 1_000_600

const BAND: Omit<ArcBandFrame, 'bpToScreenX'> = {
  arcsYDomainBp: 1000,
  arcsYLog: false,
  arcsTop: 0,
  arcsH: 40,
  pairedArcsDown: false,
  viewWidthPx: VIEW_W,
}

function block(panPx: number, reversed: boolean): BpRegionBounds {
  return {
    start: 1_000_000,
    end: 1_000_000 + REGION_BP,
    screenStartPx: -panPx,
    screenEndPx: BLOCK_W - panPx,
    reversed,
  }
}

function bar(panPx: number, reversed: boolean) {
  const toX = makeBpMapper(block(panPx, reversed))
  const mark = arcMarkFrom(
    { sx1: toX(X1), sx2: toX(X2), yBp: 500, shapeType: ARC_SHAPE_FLAT_SPLIT },
    BAND,
  )
  if (mark.kind !== 'bar') {
    throw new Error('expected a flat connector')
  }
  return mark
}

/**
 * The pass's dash coordinate at a point `fromLeft` px along the drawn line.
 * `local.x` is the offset from the line's centre in the band's unflipped px,
 * which `arcBandClipPos` mirrors for a reversed block — so a point right of
 * centre on screen carries a NEGATIVE local.x there.
 */
function gpuCoord(fromLeft: number, halfPx: number, reversed: boolean) {
  const fromCentre = fromLeft - halfPx
  return arcDashCoordPx(
    reversed ? -fromCentre : fromCentre,
    halfPx,
    reversed ? 1 : 0,
  )
}

const PERIOD = ARC_FLAT_DASH_PX + ARC_FLAT_GAP_PX

function inked(coord: number) {
  return ((coord % PERIOD) + PERIOD) % PERIOD < ARC_FLAT_DASH_PX
}

test.each([false, true])(
  'the pattern starts where Canvas2D moves to (reversed=%s)',
  reversed => {
    // Canvas2D's phase at a screen x is how far past `mid - halfPx` it is,
    // the point it began the path at. The GPU's coordinate is that distance.
    const mark = bar(0, reversed)
    for (const fromLeft of [0, 1.5, 3, 7.25, mark.halfPx * 2]) {
      expect(gpuCoord(fromLeft, mark.halfPx, reversed)).toBeCloseTo(
        fromLeft,
        10,
      )
    }
  },
)

test('a pan slides the line and leaves the pattern on it', () => {
  // Three frames of one drag. The block's screen origin is off the left edge
  // in all three, so the scissor stays at x 0 and a band x IS a screen x —
  // which is the old dash coordinate, modelled here so the difference can be
  // asserted rather than described.
  const pans = [0, 1, 2.5]
  const marks = pans.map(p => bar(p, false))
  const screenLeft = marks.map(m => m.mid - m.halfPx)
  expect(screenLeft).toEqual([160, 159, 157.5])

  // The line's own first pixel: a dash begins there in every frame.
  const coords = marks.map(m => gpuCoord(0, m.halfPx, false))
  expect(coords).toEqual([0, 0, 0])
  // Off the canvas instead, the same pixel of the same line is gap, gap, ink
  // over three frames of a drag. That is the crawl.
  expect(screenLeft.map(inked)).toEqual([false, false, true])
})

// The numeric tests above pin what the coordinate IS; this one pins that the
// pass reaches it, which is the half that regressed. `buttSegmentCoverage`'s
// twin in this directory does the same, for the same reason.
test.each([
  ['wgsl', wgsl.WGSL_SOURCE],
  ['glsl', glsl.GLSL_FRAGMENT],
])('%s dashes off the line, not the canvas', (_name, src) => {
  expect(src).toContain('arcDashCoordPx_0(')
  // The varying that carried the band x into the fragment. With it gone the
  // fragment has no canvas position left to dash from.
  expect(src).not.toContain('screenPx')
})
