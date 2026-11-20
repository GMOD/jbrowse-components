import { exportFontFamily } from '@jbrowse/core/svg/constants'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import {
  assemblyArcGapPx,
  assemblyLabelFontSizePx,
  labelGutterPx,
  labelsRunAlongArcs,
  labelWidthPx,
} from '../rulerLabels.ts'
import { renderToSvg } from './SVGCircularView.tsx'

import type { ChordVariantDisplayModel } from '../../ChordVariantDisplay/models/stateModelFactory.ts'
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
  const view = (await session.launchView(
    'CircularView',
    init,
  )) as CircularViewModel
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
  circularRefNames: string[] = [],
) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'test',
    circularRefNames,
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
  const view = (await session.launchView('CircularView', {
    assembly: 'test',
    ...viewSnap,
  })) as CircularViewModel
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
    assembly: 'volvox',
    tracks: ['sv'],
  })
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]! as ChordVariantDisplayModel
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
  await view.launchTrack('sv')
  const display = view.tracks[0]!.displays[0]! as ChordVariantDisplayModel
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
  // An arc whose two ends meet draws nothing, so each arc of the outer edge
  // must move the pen, and together they must come back round to the start
  const segments = [...d.matchAll(/([MALZ])([^MALZ]*)/g)].map(
    ([, cmd, args]) => ({
      cmd,
      xy:
        args!
          .match(/-?[\d.]+(?:e-?\d+)?/g)
          ?.map(Number)
          .slice(-2) ?? [],
    }),
  )
  const start = segments[0]!.xy
  let pen = start
  let arcs = 0
  for (const { cmd, xy } of segments.slice(1)) {
    if (cmd !== 'A') {
      break
    }
    expect(Math.hypot(xy[0]! - pen[0]!, xy[1]! - pen[1]!)).toBeGreaterThan(1)
    pen = xy
    arcs++
  }
  expect(arcs).toBeGreaterThan(1)
  expect(Math.hypot(pen[0]! - start[0]!, pen[1]! - start[1]!)).toBeLessThan(
    0.05,
  )
}, 20000)

// A sequence alone on the circle closes into a ring only where its assembly
// lists it as circular; a linear one keeps the gap that marks its two ends.
test('a lone sequence closes the ring only where its assembly lists it as circular', async () => {
  const linear = await setupRefNames(['chr1'])
  expect(linear.staticSlices[0]!.endRadians).toBeLessThan(2 * Math.PI - 1e-3)

  const circular = await setupRefNames(['chrM'], {}, ['chrM'])
  expect(circular.staticSlices[0]!.endRadians).toBeCloseTo(2 * Math.PI)
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
    { height: 500 },
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
    const anchorPx = Math.hypot(Number(x), Number(y))
    // the anchor coordinates come back rounded to 2 decimals, so measuring off
    // them is good to a small fraction of a pixel, not exactly
    expect(anchorPx + labelWidthPx(text!, 'sans-serif')).toBeLessThanOrEqual(
      halfCanvas + 0.02,
    )
    // and the on-screen figure reserves room for them in the app's font, so
    // it clips none either
    expect(anchorPx + labelWidthPx(text!)).toBeLessThanOrEqual(
      view.figureSize / 2 + 0.02,
    )
  }
}, 20000)

// Skia and Qt ignore dominant-baseline, which stood the ruler's labels on
// their radius instead of across it, so the middle shift is written into y
test('ruler labels and ticks are centred on their radius by y alone', async () => {
  const view = await setupRefNames(['ctgA', 'ctgB'])
  const svg = await renderToSvg(view, {})
  expect(svg).not.toContain('baseline')
  const ys = (fontSize: number) =>
    new Set(
      [...svg.matchAll(/<text[^>]*>/g)]
        .map(([tag]) => tag)
        .filter(tag => tag.includes(`font-size="${fontSize}"`))
        .map(tag => /\sy="([^"]*)"/.exec(tag)?.[1]),
    )
  expect(ys(13)).toEqual(new Set(['3.64']))
  expect(ys(10)).toEqual(new Set(['2.8']))
}, 20000)

// A monospace face advances every glyph 0.6em, where the Helvetica table puts
// an accession's digits at 0.56em and its `.` at 0.28em: sized from that table,
// a monospace export ran each radial label a few px past the canvas edge
test('a monospace export grows to fit its labels as that face draws them', async () => {
  const view = await setupRefNames(
    Array.from(
      { length: 24 },
      (_, i) => `NC_0000${String(i + 1).padStart(2, '0')}.11`,
    ),
    { height: 500 },
  )
  const svg = await renderToSvg(view, { fontFamily: 'monospace' })
  const halfCanvas = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]) / 2
  const labels = [
    ...svg.matchAll(
      /translate\((-?[\d.]+),(-?[\d.]+)\) rotate\(-?[\d.]+\)" fill="[^"]*">([^<]+)</g,
    ),
  ]
  expect(labels).toHaveLength(24)
  const fontSizePx = 13
  const letterSpacingPx = 0.0075 * fontSizePx
  for (const [, x, y, text] of labels) {
    const drawnWidth = text!.length * (0.6 * fontSizePx + letterSpacingPx)
    expect(Math.hypot(Number(x), Number(y)) + drawnWidth).toBeLessThanOrEqual(
      halfCanvas,
    )
  }
}, 20000)

// The gutter was sized for the export's face while the labels chose their
// orientation in the app's, so names that fit along their arcs on screen but
// not in an export's face ran along the arcs of a canvas grown for radial
// labels
test.each([undefined, 'monospace'])(
  'an export in %p orients its labels as it measured them',
  async fontFamily => {
    const view = await setupRefNames(
      Array.from(
        { length: 12 },
        (_, i) => `scaffold_00${String(i + 1).padStart(2, '0')}`,
      ),
    )
    expect(labelsRunAlongArcs(view)).toBe(true)
    expect(labelsRunAlongArcs(view, exportFontFamily(fontFamily))).toBe(false)
    const svg = await renderToSvg(view, { fontFamily })
    const anchors = new Set(
      [...svg.matchAll(/<text[^>]*>/g)]
        .map(([tag]) => tag)
        .filter(tag => tag.includes('font-size="13"'))
        .map(tag => /text-anchor="([^"]*)"/.exec(tag)?.[1]),
    )
    expect(anchors).toEqual(new Set(['start', 'end']))
  },
  20000,
)

// The assembly arc runs a gap outside the gutter the ruler labels take, and its
// name a gap outside that; in an export the gutter is measured in its face
test.each([undefined, 'monospace'])(
  'an export in %p rings its assembly names outside the labels as measured',
  async fontFamily => {
    const session = createTestSession()
    const refNames = Array.from(
      { length: 6 },
      (_, i) => `scaffold_00${String(i + 1).padStart(2, '0')}`,
    )
    for (const name of ['first', 'second']) {
      session.addAssemblyConf({
        name,
        sequence: {
          trackId: `${name}_refseq`,
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
    }
    const view = (await session.launchView('CircularView', {
      displayedRegions: ['first', 'second'].flatMap(assemblyName =>
        refNames.map(refName => ({
          assemblyName,
          refName,
          start: 0,
          end: 16000,
        })),
      ),
    })) as CircularViewModel
    view.setWidth(800)
    await session.assemblyManager.waitForAssembly('first')
    await session.assemblyManager.waitForAssembly('second')
    await when(() => view.initialized)
    const family = exportFontFamily(fontFamily)
    expect(labelGutterPx(view, family)).toBeGreaterThan(labelGutterPx(view))
    const svg = await renderToSvg(view, { fontFamily })
    const radii = [
      ...svg.matchAll(
        /<text[^>]*font-weight="600"[^>]*translate\((-?[\d.]+),(-?[\d.]+)\)/g,
      ),
    ].map(([, x, y]) => Math.hypot(Number(x), Number(y)))
    expect(radii).toHaveLength(2)
    for (const r of radii) {
      expect(r).toBeCloseTo(
        view.radiusPx +
          labelGutterPx(view, family) +
          2 * assemblyArcGapPx +
          assemblyLabelFontSizePx / 2,
        1,
      )
    }
  },
  20000,
)
