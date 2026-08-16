import PluginManager from '@jbrowse/core/PluginManager'
import { types } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './model.ts'

import type { Region } from '@jbrowse/core/util/types'

function region(refName: string, length: number): Region {
  return { assemblyName: 'test', refName, start: 0, end: length }
}

// the smallest tree the view can live in: getSession only looks for a parent
// carrying rpcManager + configuration, and the view itself only asks the
// assembly manager whether its assembly finished loading
function createView({
  regions,
  width = 800,
  height = 400,
}: {
  regions: Region[]
  width?: number
  height?: number
}) {
  const pluginManager = new PluginManager()
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const Session = types
    .model('Session', {
      view: stateModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
      assemblyManager: { get: () => ({ initialized: true }) },
    }))
  const { view } = Session.create({ view: { type: 'CircularView' } })
  view.setWidth(width)
  view.setHeight(height)
  view.setDisplayedRegions(regions)
  return view
}

test('a fitted figure exactly fills the smaller dimension of its box', () => {
  const view = createView({ regions: [region('chr1', 1_000_000)] })
  expect(view.figureSize).toBeCloseTo(400)
})

// the inter-slice gaps are part of the circumference, so a figure fitted
// without budgeting for them overshoots its box by sliceCount*spacingPx/PI and
// gets clipped — with 24 chromosomes that is ~76px off the bottom
test('the inter-slice gaps come out of the fit budget', () => {
  const view = createView({
    regions: Array.from({ length: 24 }, (_, i) =>
      region(`chr${i + 1}`, 50_000_000),
    ),
  })
  expect(view.staticSlices).toHaveLength(24)
  expect(view.figureSize).toBeCloseTo(400)
})

// contigs too narrow to see collapse into elision slices, so the number of
// gaps to budget for is not the number of displayed regions, and only settles
// once bpPerPx does
test('the fit accounts for regions elided at the fitted zoom', () => {
  const view = createView({
    regions: [
      region('chr1', 50_000_000),
      region('chr2', 50_000_000),
      ...Array.from({ length: 100 }, (_, i) => region(`scaffold${i}`, 1000)),
    ],
  })
  expect(view.staticSlices.length).toBeLessThan(102)
  expect(view.figureSize).toBeCloseTo(400)
})

test('a taller-than-wide box fits to its width', () => {
  const view = createView({
    regions: [region('chr1', 1_000_000)],
    width: 300,
    height: 900,
  })
  expect(view.figureSize).toBeCloseTo(300)
})

test('the figure is centered in the box', () => {
  const view = createView({ regions: [region('chr1', 1_000_000)] })
  const [originX, originY] = view.figureOriginXY
  expect(originX).toBeCloseTo((800 - 400) / 2)
  expect(originY).toBeCloseTo(0)
})

// The SV inspector's circular pane: a full-height column beside the
// spreadsheet, so the fit is width-bound and every spare pixel is vertical.
// Split evenly the plot floats in the middle of its own pane.
test('a taller-than-wide box hangs the figure from the top', () => {
  const view = createView({
    regions: [region('chr1', 1_000_000)],
    width: 300,
    height: 900,
  })
  expect(view.figureSize).toBeCloseTo(300)
  const [originX, originY] = view.figureOriginXY
  expect(originX).toBeCloseTo(0)
  expect(originY).toBe(0)
})

// and the case the centering is still there for: a figure bigger than its box
// overflows top and bottom equally rather than only off the bottom.
//
// Reached by zooming rather than by shrinking the box. A short box used to
// produce an oversized figure on its own, because a fixed 80px of padding took
// the whole half-box and left the radius on its `minimumRadiusPx` floor — which
// was the bug `effectivePaddingPx` fixes, not a case worth keeping as a
// fixture. Zooming past the box is the way a reader actually gets here.
test('a figure bigger than its box still overflows evenly', () => {
  const view = createView({ regions: [region('chr1', 1_000_000)] })
  view.setBpPerPx(view.bpPerPx / 4)
  const [, originY] = view.figureOriginXY
  expect(view.figureSize).toBeGreaterThan(view.height)
  expect(originY).toBeCloseTo((view.height - view.figureSize) / 2)
  expect(originY).toBeLessThan(0)
})

// zooming toward a point keeps whatever is under the cursor under the cursor:
// the point's on-screen position is figureOrigin + centerXY + its offset from
// the center, and the drawing scales that offset with the radius.
//
// 0.35 is the case the old ring-only compensation got wrong — it moved the pan
// by the whole radius change no matter where the cursor was, so zooming over a
// chord shoved the figure across the box instead of holding it still.
//
// The tall box is the other one, and the default 800x400 hides it: there the
// figure exactly fills the height, so it is bigger than the box the moment you
// zoom in and the middle stays put. In a box TALLER than the figure the figure
// hangs from the top, so growing it slides the circle's middle down by half the
// growth — compensating only the cursor offset dragged the drawing down with it,
// in exactly the SV inspector pane the top-hang was added for.
test.each([
  { f: 1, width: 800, height: 400 },
  { f: 0.35, width: 800, height: 400 },
  { f: 1, width: 300, height: 900 },
  { f: 0.35, width: 300, height: 900 },
])(
  'zoomToPoint holds a point at $f of the radius still in $width×$height',
  ({ f, width, height }) => {
    const view = createView({
      regions: [region('chr1', 1_000_000)],
      width,
      height,
    })
    const angle = 0.7
    const cursorX = view.radiusPx * f * Math.cos(angle)
    const cursorY = view.radiusPx * f * Math.sin(angle)
    const screenXY = (scale: number) => {
      const [originX, originY] = view.figureOriginXY
      const [cx, cy] = view.centerXY
      return [originX + cx + cursorX * scale, originY + cy + cursorY * scale]
    }
    const [beforeX, beforeY] = screenXY(1)
    const oldRadiusPx = view.radiusPx
    view.zoomToPoint(view.bpPerPx / 2, cursorX, cursorY)
    expect(view.radiusPx).toBeGreaterThan(oldRadiusPx)
    const [afterX, afterY] = screenXY(view.radiusPx / oldRadiusPx)
    expect(afterX).toBeCloseTo(beforeX!)
    expect(afterY).toBeCloseTo(beforeY!)
  },
)

// and the tall case is only a test of anything while the grown figure is STILL
// inside its box — once it overflows, the middle is pinned again and the bug
// this covers cannot show
test('the tall-box zoom above stays inside the box', () => {
  const view = createView({
    regions: [region('chr1', 1_000_000)],
    width: 300,
    height: 900,
  })
  view.zoomToPoint(view.bpPerPx / 2, 0, 0)
  expect(view.figureSize).toBeGreaterThan(300)
  expect(view.figureSize).toBeLessThan(900)
})

test('resetView refits and clears the zoom-to-cursor pan', () => {
  const view = createView({ regions: [region('chr1', 1_000_000)] })
  view.zoomToPoint(view.bpPerPx / 4, 100, 0)
  expect(view.autoFit).toBe(false)
  expect(view.panX).not.toBe(0)

  view.resetView()
  expect(view.autoFit).toBe(true)
  expect(view.panX).toBe(0)
  expect(view.panY).toBe(0)
  expect(view.figureSize).toBeCloseTo(400)
})

// A restored session hands the view its `displayedRegions` before anything has
// measured it, and the SvInspectorView then sizes the circle's height in one
// autorun while sizing its width in another that only runs when the circle is
// actually shown. So `setHeight` lands first, `autoFit` calls `fitToWindow`,
// and `self.width` throws by design because nothing has set volatileWidth —
// surfacing as an uncaught mobx reaction error ("SvInspectorView height
// binding") that kills the binding, leaving the subviews unsized.
test('height before width does not throw, and the fit lands once width arrives', () => {
  const pluginManager = new PluginManager()
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const Session = types
    .model('Session', {
      view: stateModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
      assemblyManager: { get: () => ({ initialized: true }) },
    }))
  const { view } = Session.create({ view: { type: 'CircularView' } })

  // the restored-session order: regions, then height, with no width yet
  view.setDisplayedRegions([region('chr1', 1_000_000)])
  expect(view.autoFit).toBe(true)
  expect(() => {
    view.setHeight(400)
  }).not.toThrow()

  // deferred, not skipped: the measurement arriving is what performs the fit
  view.setWidth(800)
  expect(view.figureSize).toBeCloseTo(400)
})

// `paddingPx` and `spacingPx` are fixed pixel counts sized for a circle with a
// window to itself, and both come out of the radius. In a narrow pane — the SV
// inspector's circle gets about a third of the width — they took most of it.
describe('the fixed-pixel geometry gives way in a small box', () => {
  const chromosomes = Array.from({ length: 24 }, (_, i) =>
    region(`chr${i + 1}`, 130_000_000),
  )

  test('a roomy circle keeps exactly the padding and spacing it declared', () => {
    const view = createView({ regions: chromosomes, width: 800, height: 800 })
    expect(view.effectivePaddingPx).toBe(view.paddingPx)
    expect(view.effectiveSpacingPx).toBe(view.spacingPx)
  })

  test('a narrow pane draws a bigger circle than the fixed padding allowed', () => {
    const big = createView({ regions: chromosomes, width: 800, height: 800 })
    const small = createView({ regions: chromosomes, width: 475, height: 316 })
    expect(small.effectivePaddingPx).toBeLessThan(big.effectivePaddingPx)
    // beats what a flat 80px left it, which is the whole complaint
    expect(small.radiusPx).toBeGreaterThan(316 / 2 - 80)
    // and holds the same shape the roomy one has, rather than merely a better
    // one: the disc is the same share of its box at both sizes
    const share = (v: { radiusPx: number; width: number; height: number }) =>
      (2 * v.radiusPx) / Math.min(v.width, v.height)
    expect(share(small)).toBeCloseTo(share(big), 1)
  })

  test('the inter-chromosome gaps cannot take a quarter of the ring', () => {
    const small = createView({ regions: chromosomes, width: 475, height: 316 })
    const gaps = chromosomes.length * small.effectiveSpacingPx
    expect(gaps / small.circumferencePx).toBeLessThan(0.26)
  })

  test('the slices are laid out on the gap the circumference charged for', () => {
    const small = createView({ regions: chromosomes, width: 475, height: 316 })
    const last = small.staticSlices.at(-1)!
    // the ring closes: the final slice ends one gap short of a full turn
    const gapRadians = small.effectiveSpacingPx / small.radiusPx
    expect(last.endRadians + gapRadians).toBeCloseTo(2 * Math.PI, 5)
  })
})
