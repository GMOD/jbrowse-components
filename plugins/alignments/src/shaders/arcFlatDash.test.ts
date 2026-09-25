import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { arcMarkScreenPath } from '../features/arcs/arcPath.ts'
import { arcMarkFrom } from '../features/arcs/mark.ts'
import { ARC_SHAPE_FLAT_SPLIT } from '../features/arcs/shapes.ts'
import * as glsl from './slang/arcFlat.glsl.generated.ts'
import * as wgsl from './slang/arcFlat.wgsl.generated.ts'

import type { ArcBandFrame } from '../features/arcs/mark.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

/**
 * Where a split-read connector's dash pattern starts: the line's SCREEN-LEFT
 * end, on all three backends.
 *
 * Canvas2D and SVG get that for free — both begin the path at `mid - halfPx`,
 * and `setLineDash` / `stroke-dasharray` start the pattern at the path's first
 * point, so it rides with the line. The GPU pass has to choose a coordinate,
 * and it dashed off the fragment's band x: an origin on the viewport, which a
 * single-region view pins to screen x 0 and leaves there, so the pattern stood
 * still while the line moved under it.
 *
 * What the fix changed is the ARGUMENT, not any arithmetic — `halfLen ±
 * local.x` cannot be wrong — so the emitted source is where it is pinned, the
 * way `buttSegmentCoverage.test.ts` pins the wiring of its own pass.
 */

const VIEW_W = 800
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

function bar(reversed: boolean) {
  const bounds: BpRegionBounds = {
    start: 1_000_000,
    end: 1_001_000,
    screenStartPx: 0,
    screenEndPx: VIEW_W,
    reversed,
  }
  const toX = makeBpMapper(bounds)
  const mark = arcMarkFrom(
    { sx1: toX(X1), sx2: toX(X2), yBp: 500, shapeType: ARC_SHAPE_FLAT_SPLIT },
    BAND,
  )
  if (mark.kind !== 'bar') {
    throw new Error('expected a flat connector')
  }
  return mark
}

test.each([false, true])(
  'the two other backends start the path at the screen-left end (reversed=%s)',
  reversed => {
    // The origin the GPU coordinate is chosen to match. A painter that moved to
    // the other end instead would put all three out of phase with each other
    // and nothing else in tree would see it.
    const mark = bar(reversed)
    const left = Math.min(mark.sx1, mark.sx2)
    expect(mark.mid - mark.halfPx).toBeCloseTo(left, 10)
    expect(arcMarkScreenPath(mark).startsWith(`M ${mark.mid - mark.halfPx} `)) //
      .toBe(true)
  },
)

test.each([
  ['wgsl', wgsl.WGSL_SOURCE],
  ['glsl', glsl.GLSL_FRAGMENT],
])('%s dashes along the mark, not across the canvas', (_name, src) => {
  // `halfLen + arcFlipX(local.x)` is zero at the line's screen-left end and
  // grows along it. Matched with its argument rather than by the callee's name:
  // the regression fed this same function a band x, and `local.y` would pass a
  // name-only check just as well.
  expect(src).toMatch(
    /dashCoverage_0\(\s*\S*halfLen\S*\s*\+\s*arcFlipX_0\(\S*local\S*\.x\)/,
  )
  // The varying that carried the band x into the fragment. With it gone the
  // fragment has no canvas position left to dash from.
  expect(src).not.toContain('screenPx')
})
