import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { labelWidthPx } from '../rulerLabels.ts'
import { renderToSvg } from './SVGCircularView.tsx'

import type { CircularViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addVolvoxConf(session: ReturnType<typeof createTestSession>) {
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: 8000,
            seq: 'a'.repeat(8000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    name: 'my svs',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'sv1',
          refName: 'ctgA',
          start: 100,
          end: 200,
          mate: { refName: 'ctgB', start: 1000, end: 1100 },
        },
      ],
    },
  })
}

// the session comes back alongside the view: `getSession(view)` types as
// AbstractSessionModel, which has no addTrackConf
async function setup(init?: Record<string, unknown>) {
  const session = createTestSession()
  addVolvoxConf(session)
  const view = session.addView('CircularView', init) as CircularViewModel
  view.setWidth(800)
  // Causal, not a wall clock: the only async precondition here is the assembly
  // load, so await that and let `when` resolve on the reaction tick after it.
  // The 15s deadline this replaces sat INSIDE a shorter jest budget, so it could
  // only ever fire before jest's own and told you nothing extra - and under a
  // loaded machine (several suites plus a build) it fired on work that normally
  // takes a few hundred ms, which is the flake it produced.
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)
  return { session, view }
}

// a view over an assembly of exactly these refNames, for the tests that are
// about the ruler's own geometry rather than about tracks
async function setupRefNames(
  refNames: string[],
  viewSnap: Record<string, unknown> = {},
) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'test',
    sequence: {
      trackId: 'test_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: refNames.map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  })
  const view = session.addView('CircularView', {
    init: { assembly: 'test' },
    ...viewSnap,
  }) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('test')
  await when(() => view.displayedRegions.length > 0)
  return view
}

// a macrotask boundary, which drains every microtask chain the export is
// suspended on (its `when`s and its dynamic imports). Not a duration guess:
// nothing here is waiting on wall-clock time
function drainMicrotasks() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

test('the figure geometry is measured after the tracks settle', async () => {
  const { view } = await setup({
    init: { assembly: 'volvox', tracks: ['sv'] },
  })
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.svgReady)

  // put the display back into "features in flight" so the export suspends
  const features = display.features
  display.setFeatures(undefined)
  expect(display.svgReady).toBe(false)

  const pending = renderToSvg(view, {})
  await drainMicrotasks()

  // ...and zoom while it is suspended there. The rulers and chords are drawn
  // from the geometry as of the end of that wait, so the canvas has to be too
  view.zoomOutButton()
  const { figureSize } = view
  display.setFeatures(features)
  const svg = await pending

  // wrapSvgExport rounds coordinates to 2 decimals on the way out
  const round2 = (n: number) => Number.parseFloat(n.toFixed(2))
  expect(svg).toContain(`viewBox="0 0 ${round2(figureSize)} `)
  expect(svg).toContain(`translate(${view.centerXY.map(round2).join(',')})`)
}, 20000)

test('exporting with nothing displayed says so instead of saving a blank', async () => {
  const { view } = await setup()
  expect(view.displayedRegions).toHaveLength(0)
  await expect(renderToSvg(view, {})).rejects.toThrow(/no regions/)
}, 20000)

// the view menu offers its track selector from the import form, and the
// display's feature fetch is gated on the view having regions — so this track
// rests forever in "fetch not started". `svgReady` has to treat that as
// terminal, or an export awaiting it hangs with no error and no output
test('a track opened before any regions leaves the export gate terminal', async () => {
  const { view } = await setup()
  view.showTrack('sv')
  const display = view.tracks[0]!.displays[0]!
  expect(display.features).toBeUndefined()
  expect(display.svgReady).toBe(true)
}, 20000)

// With no inter-slice gap coming out of its span, a lone chromosome covers the
// full 2π — and an SVG arc segment whose two endpoints coincide renders as
// nothing at all, so the ideogram ring vanished and left the label floating
test('a slice covering the whole circle still draws its ring', async () => {
  const view = await setupRefNames(['ctgA'], { spacingPx: 0 })
  expect(view.staticSlices[0]!.endRadians).toBeCloseTo(2 * Math.PI)

  const svg = await renderToSvg(view, {})
  const d = /<path d="([^"]*)"/.exec(svg)![1]!
  // M x0 y0 | A r r 0 0 1 x1 y1 | A r r 0 0 1 x2 y2
  const n = d.match(/-?[\d.]+/g)!.map(Number)
  expect(d.split('A')).toHaveLength(3)
  // the halfway point is genuinely across the circle...
  expect(Math.hypot(n[7]! - n[0]!, n[8]! - n[1]!)).toBeGreaterThan(1)
  // ...and the second half closes back onto the start
  expect(Math.hypot(n[14]! - n[0]!, n[15]! - n[1]!)).toBeLessThan(0.05)
}, 20000)

// A refName too long to sit along its own arc radiates outward instead, and the
// view's fixed paddingPx is not enough room for a 12-character RefSeq
// accession — the export used to cut the tail off at the canvas edge
test('the export canvas grows to fit labels that overrun paddingPx', async () => {
  const view = await setupRefNames(
    Array.from(
      { length: 24 },
      (_, i) => `NC_0000${String(i + 1).padStart(2, '0')}.11`,
    ),
  )
  const svg = await renderToSvg(view, {})
  const halfCanvas = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]) / 2

  // every one of these is too long for its arc, so each runs outward from its
  // anchor by its full length. All of that has to land inside the canvas
  const labels = [
    ...svg.matchAll(
      /translate\((-?[\d.]+),(-?[\d.]+)\) rotate\(-?[\d.]+\)" fill="[^"]*">([^<]+)</g,
    ),
  ]
  expect(labels).toHaveLength(24)
  for (const [, x, y, text] of labels) {
    const outerEdge = Math.hypot(Number(x), Number(y)) + labelWidthPx(text!)
    // the anchor coordinates come back rounded to 2 decimals, so measuring off
    // them is good to a small fraction of a pixel, not exactly
    expect(outerEdge).toBeLessThanOrEqual(halfCanvas + 0.02)
  }
  // and it did have to grow past what the on-screen figure reserves
  expect(view.figureSize).toBeLessThan(halfCanvas * 2)
}, 20000)
