import { getMembers, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import { LEVEL_NAVIGATIONS, LEVEL_OWN, LEVEL_PANS } from './contextLevels.ts'
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
})

test('the SVG export stacks each level and its connector above the view', async () => {
  const { view } = setup()
  const polygons = (svg: string) => svg.split('<polygon').length - 1
  // no cytobands in this assembly, so the header draws no overview trapezoid
  expect(polygons(await renderToSvg(view, {}))).toBe(0)
  view.addContextLevel()
  view.addContextLevel()
  expect(polygons(await renderToSvg(view, {}))).toBe(2)
})

test('centring a level on a coordinate centres the host there', () => {
  const { view } = setup()
  view.addContextLevel()
  const [level] = levels(view)
  level!.centerAt(100_000, 'ctgA')
  expect(centerBp(view)).toBeCloseTo(100_000, -2)
  expect(centerBp(level!)).toBe(centerBp(view))
})
