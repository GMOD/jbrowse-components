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

// zooming toward a point keeps whatever is under the cursor under the cursor:
// the point's on-screen position is figureOrigin + centerXY + its offset from
// the center, and the drawing scales that offset with the radius.
//
// 0.35 is the case the old ring-only compensation got wrong — it moved the pan
// by the whole radius change no matter where the cursor was, so zooming over a
// chord shoved the figure across the box instead of holding it still
test.each([1, 0.35])('zoomToPoint holds a point at %fx the radius still', f => {
  const view = createView({ regions: [region('chr1', 1_000_000)] })
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
