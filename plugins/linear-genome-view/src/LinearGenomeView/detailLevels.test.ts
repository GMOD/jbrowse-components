import { getMembers, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun, when } from 'mobx'

import {
  LEVEL_NAVIGATIONS,
  LEVEL_OWN,
  LEVEL_PANS,
  detailStackRows,
} from './detailLevels.ts'
import { renderToSvg } from './svgcomponents/SVGLinearGenomeView.tsx'

import type { LinearGenomeViewModel } from './index.ts'
import type { Region } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const CTG_A: Region[] = [
  { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1_000_000 },
]

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 1_000_000 },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: CTG_A,
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 400_000)
  return { session, view }
}

function levels(view: LinearGenomeViewModel) {
  return view.detailLevelViews as LinearGenomeViewModel[]
}

function centerBp(view: { windowStartBp: number; windowWidthBp: number }) {
  return view.windowStartBp + view.windowWidthBp / 2
}

test('a level shares its host regions, width and centre at a tenth of the window', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  expect(level!.displayedRegions).toBe(view.displayedRegions)
  expect(level!.width).toBe(800)
  expect(level!.windowWidthBp).toBe(800)
  expect(centerBp(level!)).toBe(centerBp(view))
  expect(level!.hideHeader).toBe(true)
  expect(level!.isDetailLevel).toBe(true)
  expect(view.isDetailLevel).toBe(false)
  expect(view.ownViews).toEqual([level])
})

test('levels stack widest first, zooming in down the page', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([800, 80])
})

// The floor is base level: a level ten times into the last one would be 8bp
// over 800px, which `zoomTo` clamps to the 16bp the view can draw
test('a level asked for past base level comes back at base level', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  view.addDetailLevel()
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([800, 80, 16])
})

test('the host moving keeps every level centred on it', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  view.horizontalScroll(100)
  for (const level of levels(view)) {
    expect(centerBp(level)).toBe(centerBp(view))
  }
})

test('a drag on a level moves the host by the same number of bases', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  const before = centerBp(view)
  level!.horizontalScroll(10)
  expect(centerBp(view)).toBe(before + 10 * level!.bpPerPx)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a scroll on a level places the host under the same centre', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  level!.scrollTo(400_000)
  expect(centerBp(level!)).toBe(400_400)
  expect(centerBp(view)).toBe(400_400)
})

test('a level zooms about the host centre and never outside it', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  level!.zoomTo(level!.bpPerPx / 2, 0)
  expect(level!.windowWidthBp).toBe(400)
  expect(centerBp(level!)).toBe(centerBp(view))
  level!.zoomTo(view.bpPerPx * 4)
  expect(level!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the host zooming in pulls a wider level in with it', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  view.zoomTo(view.bpPerPx / 100)
  expect(view.windowWidthBp).toBe(80)
  expect(level!.windowWidthBp).toBe(80)
})

test('a rubberband on a level navigates the host', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  level!.moveTo(level!.pxToBp(100), level!.pxToBp(200))
  expect(view.windowWidthBp).toBeCloseTo(100, -1)
  expect(centerBp(view)).toBeCloseTo(centerBp(level!), -1)
})

test('the snapshot carries a level and omits the key when there is none', () => {
  const { view } = setup()
  expect('detailLevels' in getSnapshot(view)).toBe(false)
  view.addDetailLevel()
  const snap = getSnapshot(view) as {
    detailLevels: { windowWidthBp: number }[]
  }
  expect(snap.detailLevels).toHaveLength(1)
  expect(snap.detailLevels[0]!.windowWidthBp).toBe(800)
})

test('removing a level leaves the rest in place', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  const [widest, closer] = levels(view)
  view.removeDetailLevel(widest!)
  expect(levels(view)).toEqual([closer])
})

test('an arrow-key slide on a level moves the host by a fraction of the level', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  const slide = jest.spyOn(view, 'slide')
  level!.slide(0.5)
  expect(slide).toHaveBeenCalledWith(0.05)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a level restored from a snapshot redirects its gestures too', () => {
  const { session } = setup()
  // the middleware rides on the level, so its install runs off the level's own
  // afterAttach — which for a stored stack is inside the host's construction
  const view = session.addView('LinearGenomeView', {
    displayedRegions: CTG_A,
    detailLevels: [
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        displayedRegions: CTG_A,
        windowWidthBp: 800,
      },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 400_000)
  const [level] = levels(view)
  const before = centerBp(view)
  level!.horizontalScroll(10)
  expect(centerBp(view)).toBe(before + 10 * level!.bpPerPx)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('every navigation-shaped action of a level is classified', () => {
  const { view } = setup()
  const notNavigation = new Set([
    'setScrollZoom',
    'setShowCenterLine',
    'getSelectedRegions',
    'setOffsets',
    'cancelZoomAnimation',
  ])
  const shape =
    /scroll|zoom|^nav|moveTo|center|^fly|slide|fit|regions|window|offsets|newView|flip/i
  const actions = [...getMembers(view).actions]
  expect(actions.length).toBeGreaterThan(50)
  expect(
    actions.filter(
      name =>
        shape.test(name) &&
        !LEVEL_PANS.has(name) &&
        !LEVEL_NAVIGATIONS.has(name) &&
        !LEVEL_OWN.has(name) &&
        !notNavigation.has(name),
    ),
  ).toEqual([])
  for (const set of [LEVEL_PANS, LEVEL_NAVIGATIONS, LEVEL_OWN]) {
    expect([...set].filter(name => !actions.includes(name))).toEqual([])
  }
  // and in exactly one of them: a name in two is a gesture whose redirect and
  // whose "this stays the level's own" both look deliberate
  const classified = [...LEVEL_PANS, ...LEVEL_NAVIGATIONS, ...LEVEL_OWN]
  expect(classified.length).toBe(new Set(classified).size)
})

const polygons = (svg: string) => svg.split('<polygon').length - 1

test('the SVG export puts the view first and each level under its connector', async () => {
  const { view } = setup()
  // no cytobands in this assembly, so the header draws no overview trapezoid
  expect(polygons(await renderToSvg(view, {}))).toBe(0)
  view.addDetailLevel()
  view.addDetailLevel()
  const svg = await renderToSvg(view, {})
  expect(polygons(svg)).toBe(2)
  // each level says how wide it is, and only the host's header names the
  // assembly the whole stack is of
  expect(svg.split('>800bp<').length - 1).toBe(1)
  expect(svg.split('>80bp<').length - 1).toBe(1)
  expect(svg.split('>volMyt1<').length - 1).toBe(1)
  // and the page zooms in as it reads down
  expect(svg.indexOf('>volMyt1<')).toBeLessThan(svg.indexOf('>800bp<'))
  expect(svg.indexOf('>800bp<')).toBeLessThan(svg.indexOf('>80bp<'))
})

test("a level's own SVG export is the host's picture of the stack", async () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  const [level] = levels(view)
  // a level alone draws no connector; two levels under their host draw two
  expect(polygons(await renderToSvg(level!, {}))).toBe(0)
  expect(polygons(await level!.exportSvg({ save: false }))).toBe(2)
})

// A drag is what opens a level, so the item is the rubberband selection's;
// removing is top-level on the level itself, which is the panel it takes away
function labels(v: LinearGenomeViewModel) {
  return v.menuItems().map(m => ('label' in m ? m.label : undefined))
}

function bandLabels(v: LinearGenomeViewModel) {
  return v.rubberBandMenuItems().map(m => ('label' in m ? m.label : undefined))
}

test("a level's menu takes it away, and no menu offers to add one to it", () => {
  const { view } = setup()
  view.addDetailLevel()
  const level = levels(view)[0]!
  expect(bandLabels(view)).toContain('Add detail level')
  expect(labels(view)).not.toContain('Add detail level')
  expect(labels(view)).not.toContain('Remove detail level')
  expect(labels(level)).toContain('Remove detail level')
  expect(bandLabels(level)).not.toContain('Add detail level')
})

// The span the selection covers, and the place it covers it: the view recentres
// on the drag, since every level shares its host's centre
test('a drag opens a level over exactly what it selected', () => {
  const { view } = setup()
  view.addDetailLevelForSpan(view.pxToBp(100), view.pxToBp(300))
  const [level] = levels(view)
  expect(level!.windowWidthBp).toBeCloseTo(2000, -1)
  expect(centerBp(view)).toBeCloseTo(402_000, -2)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('the level a drag opens carries the tracks the view is showing', async () => {
  const { session, view } = setup()
  await when(
    () =>
      session.assemblyManager.assemblies.length ===
      session.assemblyManager.assemblyNamesList.length,
  )
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Genes',
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  await view.launchTrack('genes')
  view.addDetailLevelForSpan(view.pxToBp(100), view.pxToBp(300))
  const [level] = levels(view)
  await when(() => level!.tracks.length === 1)
  expect(level!.tracks[0]!.configuration.trackId).toBe('genes')
})

test('a drag with no selection opens nothing', () => {
  const { view } = setup()
  expect(view.addDetailLevelForSpan(undefined, undefined)).toBeUndefined()
  expect(levels(view)).toHaveLength(0)
})

test('the connector band is one height for the stack, with a floor', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  view.setDetailConnectorHeight(view.detailConnectorHeight + 40)
  expect(view.detailConnectorHeight).toBe(56)
  // a level keeps no height of its own, so every band moves together
  expect(levels(view).map(l => l.detailConnectorHeight)).toEqual([16, 16])
  view.setDetailConnectorHeight(-10)
  expect(view.detailConnectorHeight).toBe(4)
})

test('the SVG export draws the connectors at the height they were dragged to', async () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  view.setDetailConnectorHeight(64)
  const svg = await renderToSvg(view, {})
  // two bottom corners each, both trapezoids on the band's floor
  expect(svg.split(',64 ').length - 1).toBe(4)
  // and they fade from the narrow end down, rather than filling flat
  expect(svg.split('<linearGradient').length - 1).toBe(2)
})

test('centring a level on a coordinate centres the host there', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  level!.centerAt(100_000, 'ctgA')
  expect(centerBp(view)).toBeCloseTo(100_000, -2)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a level moved off the host centre without a width change snaps back', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  // LEVEL_OWN, so the middleware passes it through: the level writes its own
  // window, at the width it already had
  level!.setWindow(level!.windowWidthBp, level!.windowStartBp + 10_000)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('dispatching a level action does not make the caller depend on the stack', () => {
  const { view } = setup()
  view.addDetailLevel()
  const [level] = levels(view)
  let runs = 0
  const stop = autorun(() => {
    runs++
    level!.horizontalScroll(0)
  })
  expect(runs).toBe(1)
  view.addDetailLevel()
  expect(runs).toBe(1)
  stop()
})

test('a level opens with the span and the tracks it was asked for', async () => {
  const { session, view } = setup()
  await when(
    () =>
      session.assemblyManager.assemblies.length ===
      session.assemblyManager.assemblyNamesList.length,
  )
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Genes',
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  view.addDetailLevel({ windowWidthBp: 2000, trackIds: ['genes'] })
  const [level] = levels(view)
  expect(level!.windowWidthBp).toBe(2000)
  await when(() => level!.tracks.length === 1)
  expect(level!.tracks[0]!.configuration.trackId).toBe('genes')
})

test('a span between two levels lands between them', () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  view.addDetailLevel({ windowWidthBp: 200 })
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([800, 200, 80])
})

// A level wider than the view shows more than the tracks above it, and the sync
// is what refuses it: an agent's call finds out by the level coming back at the
// view's own span.
test('a level asked for wider than the view comes back at the view', () => {
  const { view } = setup()
  view.addDetailLevel({ windowWidthBp: 100_000 })
  expect(levels(view)[0]!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the stack reads down from the host into closer views', () => {
  expect(detailStackRows('host', ['near', 'far'])).toEqual([
    { level: 'near', context: 'host' },
    { level: 'far', context: 'near' },
  ])
  expect(detailStackRows('host', [])).toEqual([])
})

// Each trapezoid's two horizontal edges, as the widths they were drawn at: the
// narrow top edge is the span the row below shows, marked on the row above; the
// full-width bottom edge is that row itself.
function trapezoidEdges(svg: string) {
  return [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map(match => {
    const points = match[1]!
      .split(' ')
      .map(pair => pair.split(',').map(Number) as [number, number])
    const ys = points.map(([, y]) => y)
    const widthAt = (y: number) => {
      const xs = points.filter(point => point[1] === y).map(([x]) => x)
      return Math.max(...xs) - Math.min(...xs)
    }
    return { top: widthAt(Math.min(...ys)), bottom: widthAt(Math.max(...ys)) }
  })
}

// Every trapezoid in the stack points the way the header overview's does, which
// is what makes the page one ladder rather than two conventions meeting at the
// tracks
test('each connector fans out downward and holds its colour at the top', async () => {
  const { view } = setup()
  view.addDetailLevel()
  view.addDetailLevel()
  const svg = await renderToSvg(view, {})
  expect(trapezoidEdges(svg).map(({ top, bottom }) => top < bottom)).toEqual([
    true,
    true,
  ])
  expect(
    [...svg.matchAll(/<linearGradient[^>]*y1="(\d)"/g)].map(match => match[1]),
  ).toEqual(['0', '0'])
})
