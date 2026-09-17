import { getMembers, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun, when } from 'mobx'

import {
  LEVEL_NAVIGATIONS,
  LEVEL_OWN,
  LEVEL_PANS,
  contextStackRows,
} from './contextLevels.ts'
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
  return view.contextLevelViews as LinearGenomeViewModel[]
}

function centerBp(view: { windowStartBp: number; windowWidthBp: number }) {
  return view.windowStartBp + view.windowWidthBp / 2
}

test('a level shares its host regions, width and centre at ten times the window', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  expect(level!.displayedRegions).toBe(view.displayedRegions)
  expect(level!.width).toBe(800)
  expect(level!.windowWidthBp).toBe(80_000)
  expect(centerBp(level!)).toBe(centerBp(view))
  expect(level!.hideHeader).toBe(true)
  expect(level!.isContextLevel).toBe(true)
  expect(view.isContextLevel).toBe(false)
  expect(view.ownViews).toEqual([level])
})

test('levels stack widest first', () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([800_000, 80_000])
})

test('the host moving keeps every level centred on it', () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  view.horizontalScroll(100)
  for (const level of levels(view)) {
    expect(centerBp(level)).toBe(centerBp(view))
  }
})

test('a drag on a level moves the host by the same number of bases', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  const before = centerBp(view)
  level!.horizontalScroll(10)
  expect(centerBp(view)).toBe(before + 10 * level!.bpPerPx)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a scroll on a level places the host under the same centre', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  level!.scrollTo(0)
  expect(centerBp(level!)).toBe(40_000)
  expect(centerBp(view)).toBe(40_000)
})

test('a level zooms about the host centre and never inside it', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  level!.zoomTo(level!.bpPerPx / 2, 0)
  expect(level!.windowWidthBp).toBe(40_000)
  expect(centerBp(level!)).toBe(centerBp(view))
  level!.zoomTo(view.bpPerPx / 4)
  expect(level!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the host zooming out pushes a narrower level out with it', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  view.zoomTo(view.bpPerPx * 100)
  expect(view.windowWidthBp).toBe(800_000)
  expect(level!.windowWidthBp).toBe(800_000)
})

test('a rubberband on a level navigates the host', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  level!.moveTo(level!.pxToBp(100), level!.pxToBp(200))
  expect(view.windowWidthBp).toBeCloseTo(10_000, -1)
  expect(centerBp(view)).toBeCloseTo(centerBp(level!), -1)
})

test('the snapshot carries a level and omits the key when there is none', () => {
  const { view } = setup()
  expect('contextLevels' in getSnapshot(view)).toBe(false)
  view.addContextLevel()
  const snap = getSnapshot(view) as {
    contextLevels: { windowWidthBp: number }[]
  }
  expect(snap.contextLevels).toHaveLength(1)
  expect(snap.contextLevels[0]!.windowWidthBp).toBe(80_000)
})

test('removing a level leaves the rest in place', () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  const [widest, narrower] = levels(view)
  view.removeContextLevel(widest!)
  expect(levels(view)).toEqual([narrower])
})

test('an arrow-key slide on a level moves the host by a fraction of the level', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  const slide = jest.spyOn(view, 'slide')
  level!.slide(0.5)
  expect(slide).toHaveBeenCalledWith(5)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a level restored from a snapshot redirects its gestures too', () => {
  const { session } = setup()
  // the middleware rides on the level, so its install runs off the level's own
  // afterAttach — which for a stored stack is inside the host's construction
  const view = session.addView('LinearGenomeView', {
    displayedRegions: CTG_A,
    contextLevels: [
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        displayedRegions: CTG_A,
        windowWidthBp: 80_000,
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

test('the SVG export stacks each level and its connector above the view', async () => {
  const { view } = setup()
  // no cytobands in this assembly, so the header draws no overview trapezoid
  expect(polygons(await renderToSvg(view, {}))).toBe(0)
  view.addContextLevel()
  view.addContextLevel()
  const svg = await renderToSvg(view, {})
  expect(polygons(svg)).toBe(2)
  // each level says how wide it is, and only the host's header names the
  // assembly the whole stack is of
  expect(svg.split('>80Kbp<').length - 1).toBe(1)
  expect(svg.split('>800Kbp<').length - 1).toBe(1)
  expect(svg.split('>volMyt1<').length - 1).toBe(1)
})

test("a level's own SVG export is the host's picture of the stack", async () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  const [level] = levels(view)
  // a level alone draws no connector; two levels above their host draw two
  expect(polygons(await renderToSvg(level!, {}))).toBe(0)
  expect(polygons(await level!.exportSvg({ save: false }))).toBe(2)
})

test("a level's menu takes it away, and does not offer to add another", () => {
  const { view } = setup()
  view.addContextLevel()
  const labels = (v: LinearGenomeViewModel) =>
    v.menuItems().map(m => ('label' in m ? m.label : undefined))
  expect(labels(view)).toContain('Add context level')
  expect(labels(levels(view)[0]!)).toContain('Remove context level')
  expect(labels(levels(view)[0]!)).not.toContain('Add context level')
})

test('a view already zoomed all the way out offers no level above it', () => {
  const { view } = setup()
  const addItem = (v: LinearGenomeViewModel) =>
    v.menuItems().find(m => 'label' in m && m.label === 'Add context level')
  expect(addItem(view)).toMatchObject({ disabled: false })
  view.showAllRegions()
  expect(addItem(view)).toMatchObject({ disabled: true })
})

test('the connector band is one height for the stack, with a floor', () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  view.setContextConnectorHeight(view.contextConnectorHeight + 40)
  expect(view.contextConnectorHeight).toBe(56)
  // a level keeps no height of its own, so every band moves together
  expect(levels(view).map(l => l.contextConnectorHeight)).toEqual([16, 16])
  view.setContextConnectorHeight(-10)
  expect(view.contextConnectorHeight).toBe(4)
})

test('the SVG export draws the connectors at the height they were dragged to', async () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  view.setContextConnectorHeight(64)
  const svg = await renderToSvg(view, {})
  // two bottom corners each, both trapezoids on the band's floor
  expect(svg.split(',64 ').length - 1).toBe(4)
  // and they fade from the narrow end down, rather than filling flat
  expect(svg.split('<linearGradient').length - 1).toBe(2)
})

test('centring a level on a coordinate centres the host there', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  level!.centerAt(100_000, 'ctgA')
  expect(centerBp(view)).toBeCloseTo(100_000, -2)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('a level moved off the host centre without a width change snaps back', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  // LEVEL_OWN, so the middleware passes it through: the level writes its own
  // window, at the width it already had
  level!.setWindow(level!.windowWidthBp, level!.windowStartBp + 10_000)
  expect(centerBp(level!)).toBe(centerBp(view))
})

test('dispatching a level action does not make the caller depend on the stack', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  let runs = 0
  const stop = autorun(() => {
    runs++
    level!.horizontalScroll(0)
  })
  expect(runs).toBe(1)
  view.addContextLevel()
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
  view.addContextLevel({ windowWidthBp: 200_000, trackIds: ['genes'] })
  const [level] = levels(view)
  expect(level!.windowWidthBp).toBe(200_000)
  await when(() => level!.tracks.length === 1)
  expect(level!.tracks[0]!.configuration.trackId).toBe('genes')
})

test('a span between two levels lands between them', () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  view.addContextLevel({ windowWidthBp: 200_000 })
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([
    800_000, 200_000, 80_000,
  ])
})

// A level narrower than the view shows less than the tracks under it, and the
// sync is what refuses it: the dialog's field says so up front, an agent's call
// finds out by the level coming back at the view's own span.
test('a level asked for narrower than the view comes back at the view', () => {
  const { view } = setup()
  view.addContextLevel({ windowWidthBp: 100 })
  expect(levels(view)[0]!.windowWidthBp).toBe(view.windowWidthBp)
})

test('the side the stack sits on is one flag the snapshot omits by default', () => {
  const { view } = setup()
  expect(view.contextLevelsBelow).toBe(false)
  expect('contextLevelsBelow' in getSnapshot(view)).toBe(false)
  view.setContextLevelsBelow(true)
  expect(
    (getSnapshot(view) as { contextLevelsBelow?: boolean }).contextLevelsBelow,
  ).toBe(true)
})

test('the stack reads down to the tracks above them, and outward below', () => {
  expect(contextStackRows('host', ['wide', 'mid'], false)).toEqual([
    { level: 'wide', detail: 'mid' },
    { level: 'mid', detail: 'host' },
  ])
  expect(contextStackRows('host', ['wide', 'mid'], true)).toEqual([
    { level: 'mid', detail: 'host' },
    { level: 'wide', detail: 'mid' },
  ])
  expect(contextStackRows('host', [], true)).toEqual([])
})

// Each trapezoid's two horizontal edges, as the widths they were drawn at: the
// narrow one is the span the wider level shows, the full-width one is the row
// it details. Which of the two is on top is the whole of the flip.
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

test('a stack under the tracks exports the view first and flips its trapezoids', async () => {
  const { view } = setup()
  view.addContextLevel()
  view.addContextLevel()
  const above = await renderToSvg(view, {})
  view.setContextLevelsBelow(true)
  const below = await renderToSvg(view, {})

  // the host's header names the assembly once; each level's band names its span
  expect(above.indexOf('>volMyt1<')).toBeGreaterThan(above.indexOf('>800Kbp<'))
  expect(below.indexOf('>volMyt1<')).toBeLessThan(below.indexOf('>80Kbp<'))
  // and under the tracks the stack widens downward, so the widest level is the
  // last row rather than the first
  expect(below.indexOf('>80Kbp<')).toBeLessThan(below.indexOf('>800Kbp<'))

  expect(polygons(below)).toBe(2)
  expect(trapezoidEdges(above).map(({ top, bottom }) => top < bottom)).toEqual([
    true,
    true,
  ])
  expect(trapezoidEdges(below).map(({ top, bottom }) => top > bottom)).toEqual([
    true,
    true,
  ])
  // the fade holds its colour at the narrow end either way, which is the end a
  // mirrored gradient has to follow the shape to
  const fadeFrom = (svg: string) =>
    [...svg.matchAll(/<linearGradient[^>]*y1="(\d)"/g)].map(match => match[1])
  expect(fadeFrom(above)).toEqual(['0', '0'])
  expect(fadeFrom(below)).toEqual(['1', '1'])
})
