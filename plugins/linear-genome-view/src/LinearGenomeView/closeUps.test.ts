import { resolveSubMenu } from '@jbrowse/core/ui'
import { getMembers, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun, when } from 'mobx'

import {
  CLOSE_UP_NAVIGATIONS,
  CLOSE_UP_OWN,
  CLOSE_UP_PANS,
  closeUpStackRows,
} from './closeUps.ts'
import {
  CLOSE_UP_CONNECTOR_HEIGHT,
  MIN_CLOSE_UP_CONNECTOR_HEIGHT,
} from './consts.ts'
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

function closeUps(view: LinearGenomeViewModel) {
  return view.closeUpViews as LinearGenomeViewModel[]
}

function centerBp(view: { windowStartBp: number; windowWidthBp: number }) {
  return view.windowStartBp + view.windowWidthBp / 2
}

test('a close-up shares its host regions, width and centre at a tenth of the window', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  expect(closeUp!.displayedRegions).toBe(view.displayedRegions)
  expect(closeUp!.width).toBe(800)
  expect(closeUp!.windowWidthBp).toBe(800)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
  expect(closeUp!.hideHeader).toBe(true)
  expect(closeUp!.isCloseUp).toBe(true)
  expect(view.isCloseUp).toBe(false)
  expect(view.ownViews).toEqual([closeUp])
})

test('close-ups stack widest first, zooming in down the page', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  expect(closeUps(view).map(l => l.windowWidthBp)).toEqual([800, 80])
})

// The floor is base level: a close-up ten times into the last one would be 8bp
// over 800px, which `zoomTo` clamps to the 16bp the view can draw
test('a close-up asked for past base level comes back at base level', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  view.addCloseUp()
  expect(closeUps(view).map(l => l.windowWidthBp)).toEqual([800, 80, 16])
})

test('the host moving keeps every close-up centred on it', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  view.horizontalScroll(100)
  for (const closeUp of closeUps(view)) {
    expect(centerBp(closeUp)).toBe(centerBp(view))
  }
})

test('a drag on a close-up moves the host by the same number of bases', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  const before = centerBp(view)
  closeUp!.horizontalScroll(10)
  expect(centerBp(view)).toBe(before + 10 * closeUp!.bpPerPx)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('a scroll on a close-up places the host under the same centre', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  closeUp!.scrollTo(400_000)
  expect(centerBp(closeUp!)).toBe(400_400)
  expect(centerBp(view)).toBe(400_400)
})

test('a close-up zooms about the host centre and never outside it', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  closeUp!.zoomTo(closeUp!.bpPerPx / 2, 0)
  expect(closeUp!.windowWidthBp).toBe(400)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
  closeUp!.zoomTo(view.bpPerPx * 4)
  expect(closeUp!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the host zooming in pulls a wider close-up in with it', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  view.zoomTo(view.bpPerPx / 100)
  expect(view.windowWidthBp).toBe(80)
  expect(closeUp!.windowWidthBp).toBe(80)
})

test('a rubberband on a close-up navigates the host', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  closeUp!.moveTo(closeUp!.pxToBp(100), closeUp!.pxToBp(200))
  expect(view.windowWidthBp).toBeCloseTo(100, -1)
  expect(centerBp(view)).toBeCloseTo(centerBp(closeUp!), -1)
})

test('the snapshot carries a close-up and omits the key when there is none', () => {
  const { view } = setup()
  expect('closeUps' in getSnapshot(view)).toBe(false)
  view.addCloseUp()
  const snap = getSnapshot(view) as {
    closeUps: { windowWidthBp: number }[]
  }
  expect(snap.closeUps).toHaveLength(1)
  expect(snap.closeUps[0]!.windowWidthBp).toBe(800)
})

test('removing a close-up leaves the rest in place', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  const [widest, closer] = closeUps(view)
  view.removeCloseUp(widest!)
  expect(closeUps(view)).toEqual([closer])
})

test('returning to the import form takes the close-ups with the tracks', () => {
  const { view } = setup()
  view.addCloseUp()
  view.clearView()
  expect(closeUps(view)).toEqual([])
  expect(view.showImportForm).toBe(true)
})

test('an arrow-key slide on a close-up moves the host by a fraction of the close-up', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  const slide = jest.spyOn(view, 'slide')
  closeUp!.slide(0.5)
  expect(slide).toHaveBeenCalledWith(0.05)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('a close-up restored from a snapshot redirects its gestures too', () => {
  const { session } = setup()
  // the middleware rides on the close-up, so its install runs off the
  // close-up's own afterAttach — which for a stored stack is inside the host's
  // construction
  const view = session.addView('LinearGenomeView', {
    displayedRegions: CTG_A,
    closeUps: [
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
  const [closeUp] = closeUps(view)
  const before = centerBp(view)
  closeUp!.horizontalScroll(10)
  expect(centerBp(view)).toBe(before + 10 * closeUp!.bpPerPx)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('every navigation-shaped action of a close-up is classified', () => {
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
        !CLOSE_UP_PANS.has(name) &&
        !CLOSE_UP_NAVIGATIONS.has(name) &&
        !CLOSE_UP_OWN.has(name) &&
        !notNavigation.has(name),
    ),
  ).toEqual([])
  for (const set of [CLOSE_UP_PANS, CLOSE_UP_NAVIGATIONS, CLOSE_UP_OWN]) {
    expect([...set].filter(name => !actions.includes(name))).toEqual([])
  }
  // and in exactly one of them: a name in two is a gesture whose redirect and
  // whose "this stays the close-up's own" both look deliberate
  const classified = [
    ...CLOSE_UP_PANS,
    ...CLOSE_UP_NAVIGATIONS,
    ...CLOSE_UP_OWN,
  ]
  expect(classified.length).toBe(new Set(classified).size)
})

const polygons = (svg: string) => svg.split('<polygon').length - 1

test('the SVG export puts the view first and each close-up under its connector', async () => {
  const { view } = setup()
  // no cytobands in this assembly, so the header draws no overview trapezoid
  expect(polygons(await renderToSvg(view, {}))).toBe(0)
  view.addCloseUp()
  view.addCloseUp()
  const svg = await renderToSvg(view, {})
  expect(polygons(svg)).toBe(2)
  // each close-up says how wide it is, and only the host's header names the
  // assembly the whole stack is of
  expect(svg.split('>800bp<').length - 1).toBe(1)
  expect(svg.split('>80bp<').length - 1).toBe(1)
  expect(svg.split('>volMyt1<').length - 1).toBe(1)
  // and the page zooms in as it reads down
  expect(svg.indexOf('>volMyt1<')).toBeLessThan(svg.indexOf('>800bp<'))
  expect(svg.indexOf('>800bp<')).toBeLessThan(svg.indexOf('>80bp<'))
})

test("a close-up's own SVG export is the host's picture of the stack", async () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  // a close-up alone draws no connector; two close-ups under their host draw
  // two
  expect(polygons(await renderToSvg(closeUp!, {}))).toBe(0)
  expect(polygons(await closeUp!.exportSvg({ save: false }))).toBe(2)
})

// A drag is what opens a close-up, so the item is under the rubberband
// selection's Launch; removing is top-level on the close-up itself, which is
// the panel it takes away
function labels(v: LinearGenomeViewModel) {
  return v.menuItems().map(m => ('label' in m ? m.label : undefined))
}

function launchLabels(v: LinearGenomeViewModel) {
  const launch = v
    .rubberBandMenuItems()
    .find(m => 'label' in m && m.label === 'Launch')
  return (launch && 'subMenu' in launch ? resolveSubMenu(launch) : []).map(m =>
    'label' in m ? m.label : undefined,
  )
}

test("a close-up's menu takes it away, and no menu offers to add one to it", () => {
  const { view } = setup()
  view.addCloseUp()
  const closeUp = closeUps(view)[0]!
  expect(launchLabels(view)).toContain('Close-up view')
  expect(labels(view)).not.toContain('Close-up view')
  expect(labels(view)).not.toContain('Remove close-up view')
  expect(labels(closeUp)).toContain('Remove close-up view')
  expect(launchLabels(closeUp)).not.toContain('Close-up view')
})

// The span the selection covers, and the place it covers it: the view recentres
// on the drag, since every close-up shares its host's centre
test('a drag opens a close-up over exactly what it selected', () => {
  const { view } = setup()
  view.addCloseUpForSpan(view.pxToBp(100), view.pxToBp(300))
  const [closeUp] = closeUps(view)
  expect(closeUp!.windowWidthBp).toBeCloseTo(2000, -1)
  expect(centerBp(view)).toBeCloseTo(402_000, -2)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('the close-up a drag opens carries the tracks the view is showing', async () => {
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
  view.addCloseUpForSpan(view.pxToBp(100), view.pxToBp(300))
  const [closeUp] = closeUps(view)
  await when(() => closeUp!.tracks.length === 1)
  expect(closeUp!.tracks[0]!.configuration.trackId).toBe('genes')
})

test('a drag with no selection opens nothing', () => {
  const { view } = setup()
  expect(view.addCloseUpForSpan(undefined, undefined)).toBeUndefined()
  expect(closeUps(view)).toHaveLength(0)
})

test('the connector band is one height for the stack, with a floor', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  view.setCloseUpConnectorHeight(CLOSE_UP_CONNECTOR_HEIGHT + 40)
  expect(view.closeUpConnectorHeight).toBe(CLOSE_UP_CONNECTOR_HEIGHT + 40)
  // a close-up keeps no height of its own, so every band moves together
  expect(closeUps(view).map(l => l.closeUpConnectorHeight)).toEqual([
    CLOSE_UP_CONNECTOR_HEIGHT,
    CLOSE_UP_CONNECTOR_HEIGHT,
  ])
  view.setCloseUpConnectorHeight(-10)
  expect(view.closeUpConnectorHeight).toBe(MIN_CLOSE_UP_CONNECTOR_HEIGHT)
})

test('the SVG export draws the connectors at the height they were dragged to', async () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  view.setCloseUpConnectorHeight(64)
  const svg = await renderToSvg(view, {})
  // two bottom corners each, both trapezoids on the band's floor
  expect(svg.split(',64 ').length - 1).toBe(4)
  // and they fade from the narrow end down, rather than filling flat
  expect(svg.split('<linearGradient').length - 1).toBe(2)
})

test('centring a close-up on a coordinate centres the host there', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  closeUp!.centerAt(100_000, 'ctgA')
  expect(centerBp(view)).toBeCloseTo(100_000, -2)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('a close-up moved off the host centre without a width change snaps back', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  // CLOSE_UP_OWN, so the middleware passes it through: the close-up writes its
  // own window, at the width it already had
  closeUp!.setWindow(closeUp!.windowWidthBp, closeUp!.windowStartBp + 10_000)
  expect(centerBp(closeUp!)).toBe(centerBp(view))
})

test('dispatching a close-up action does not make the caller depend on the stack', () => {
  const { view } = setup()
  view.addCloseUp()
  const [closeUp] = closeUps(view)
  let runs = 0
  const stop = autorun(() => {
    runs++
    closeUp!.horizontalScroll(0)
  })
  expect(runs).toBe(1)
  view.addCloseUp()
  expect(runs).toBe(1)
  stop()
})

test('a close-up opens with the span and the tracks it was asked for', async () => {
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
  view.addCloseUp({ windowWidthBp: 2000, trackIds: ['genes'] })
  const [closeUp] = closeUps(view)
  expect(closeUp!.windowWidthBp).toBe(2000)
  await when(() => closeUp!.tracks.length === 1)
  expect(closeUp!.tracks[0]!.configuration.trackId).toBe('genes')
})

test('a span between two close-ups lands between them', () => {
  const { view } = setup()
  view.addCloseUp()
  view.addCloseUp()
  view.addCloseUp({ windowWidthBp: 200 })
  expect(closeUps(view).map(l => l.windowWidthBp)).toEqual([800, 200, 80])
})

// A close-up wider than the view shows more than the tracks above it, and the
// sync is what refuses it: an agent's call finds out by the close-up coming
// back at the view's own span.
test('a close-up asked for wider than the view comes back at the view', () => {
  const { view } = setup()
  view.addCloseUp({ windowWidthBp: 100_000 })
  expect(closeUps(view)[0]!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the stack reads down from the host into closer views', () => {
  expect(closeUpStackRows('host', ['near', 'far'])).toEqual([
    { closeUp: 'near', context: 'host' },
    { closeUp: 'far', context: 'near' },
  ])
  expect(closeUpStackRows('host', [])).toEqual([])
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
  view.addCloseUp()
  view.addCloseUp()
  const svg = await renderToSvg(view, {})
  expect(trapezoidEdges(svg).map(({ top, bottom }) => top < bottom)).toEqual([
    true,
    true,
  ])
  expect(
    [...svg.matchAll(/<linearGradient[^>]*y1="(\d)"/g)].map(match => match[1]),
  ).toEqual(['0', '0'])
})
