import { getSession } from '@jbrowse/core/util'
import { getMembers } from '@jbrowse/mobx-state-tree'
import { showRegionsWithUndo } from '@jbrowse/plugin-linear-genome-view'
import { createTestSession } from '@jbrowse/web/testUtils'
import { transaction, when } from 'mobx'

import { centerStackOnFeature } from '../SyntenyFeatureDetail/centerOnFeature.ts'
import {
  ROW_GESTURES,
  ROW_NAVIGATIONS_HELD,
} from '../SyntenyFollow/installSyntenyFollow.ts'

import type { LinearSyntenyViewModel } from './model.ts'

type WebSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let openViews: { session: WebSession; view: LinearSyntenyViewModel }[] = []

afterEach(() => {
  for (const { session, view } of openViews) {
    session.removeView(view)
  }
  openViews = []
})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

const NAMES = ['volvox0', 'volvox1', 'volvox2']

// Three rows, and no synteny track unless the spec opens `synteny01`: what is
// under test is which row a gesture lands on, which the follow decides before
// any alignment is read.
async function launchStack(spec: Record<string, unknown>) {
  const session = createTestSession()
  for (const name of [...NAMES, 'volvox3']) {
    session.addAssemblyConf(assembly(name))
  }
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'synteny01',
    assemblyNames: ['volvox0', 'volvox1'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'none.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox0',
      targetAssembly: 'volvox1',
    },
  })
  const view = (await session.launchView('LinearSyntenyView', {
    views: NAMES.map(name => ({ assembly: name, loc: 'ctgA:1-8000' })),
    ...spec,
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () =>
      view.views.length === 3 &&
      view.views.every(v => v.initialized) &&
      !view.initPending,
  )
  openViews.push({ session, view })
  return view
}

async function openStack() {
  const view = await launchStack({})
  view.setFollowSynteny(true)
  return view
}

// A followed row that snapped back after a drag read as a bug.
test('a drag or a zoom on a followed row makes it the anchor', async () => {
  const view = await openStack()
  expect(view.followAnchorIndex).toBe(0)
  view.views[2]!.horizontalScroll(40)
  expect(view.followAnchorIndex).toBe(2)
  view.views[1]!.zoomTo(view.views[1]!.bpPerPx * 2)
  expect(view.followAnchorIndex).toBe(1)
})

test('the header zoom and pan buttons on a followed row take it too', async () => {
  const view = await openStack()
  view.views[1]!.zoom(view.views[1]!.bpPerPx * 2)
  expect(view.followAnchorIndex).toBe(1)
  view.views[2]!.slide(0.9)
  expect(view.followAnchorIndex).toBe(2)
})

test('the search box on a followed row takes it before the navigation lands', async () => {
  const view = await openStack()
  const landing = view.views[2]!.navToLocString('ctgA:100-200')
  expect(view.followAnchorIndex).toBe(2)
  await landing
  expect(view.followAnchorIndex).toBe(2)
})

test("the anchor row's own gesture changes nothing", async () => {
  const view = await openStack()
  view.views[0]!.horizontalScroll(40)
  expect(view.followAnchorIndex).toBe(0)
})

// Collapsed introns and alignments' mate views replace the row's regions; the
// follow held that as its own navigation and put the row straight back.
test("replacing a followed row's regions with an Undo takes the anchor", async () => {
  const view = await openStack()
  const row = view.views[2]!
  const regions = [
    { assemblyName: 'volvox2', refName: 'ctgA', start: 1000, end: 2000 },
  ]
  showRegionsWithUndo({ view: row, regions, message: 'Collapsed introns' })
  expect(view.followAnchorIndex).toBe(2)
  expect(row.displayedRegions).toEqual(regions)
  expect(row.windowWidthBp).toBeLessThanOrEqual(1000)
})

test('a navigation held for the follow is not a gesture', async () => {
  const view = await openStack()
  view.holdFollowAnchor(() => {
    view.views[2]!.horizontalScroll(40)
    view.views[1]!.zoomTo(view.views[1]!.bpPerPx * 2)
  })
  expect(view.followAnchorIndex).toBe(0)
})

// The band's drag and wheel drive every row from a React handler, where a
// plain transaction makes each row's call a root action and the follow reads
// N gestures, the last non-anchor row winning. The drag runs as the stack's
// `panStack` and `useWheelScrollZoom`'s `hold` under `holdFollowAnchor`.
test('a band gesture over every row is held, not taken by the last row', async () => {
  const view = await openStack()
  transaction(() => {
    for (const row of view.views) {
      row.horizontalScroll(40)
    }
  })
  expect(view.followAnchorIndex).toBe(2)
  view.setFollowAnchorIndex(0)
  view.holdFollowAnchor(() => {
    transaction(() => {
      for (const row of view.views) {
        row.horizontalScroll(40)
      }
    })
  })
  expect(view.followAnchorIndex).toBe(0)
})

// While following, the follow places a row whose level has a synteny track,
// and a band drag moving it too would pan it past its placement. A row across
// a trackless level is one the follow never places, so the drag moves it.
test('a band drag moves every row the follow does not place', async () => {
  const view = await launchStack({ tracks: [['synteny01'], []] })
  await when(() => !!view.levels[0]!.linearSyntenyDisplays[0]?.featureData)
  view.setFollowSynteny(true)
  const offsets = () => view.views.map(row => row.offsetPx)
  const before = offsets()
  view.panStack(40)
  expect(offsets()).toEqual([before[0]! + 40, before[1], before[2]! + 40])
  expect(view.followAnchorIndex).toBe(0)

  view.setFollowSynteny(false)
  const after = offsets()
  view.panStack(40)
  expect(offsets()).toEqual(after.map(x => x + 40))
})

test('with no synteny track a band drag moves every row, following or not', async () => {
  const view = await openStack()
  const before = view.views.map(row => row.offsetPx)
  view.panStack(40)
  expect(view.views.map(row => row.offsetPx)).toEqual(before.map(x => x + 40))
})

// the view-wide zooms reach every row from one of the stack's own actions,
// which nests the rows' zooms under it
test('a view-wide zoom is not one either', async () => {
  const view = await openStack()
  view.squareView()
  view.showAllRegionsAcrossRows(false)
  expect(view.followAnchorIndex).toBe(0)
})

// The stack's rubber band zooms every row from a menu click, where each row's
// `moveTo` was a root action of its own and the last row took the anchor.
test("the stack's rubber-band zoom leaves the anchor where it was", async () => {
  const view = await openStack()
  for (const row of view.views) {
    row.setOffsets(row.pxToBp(100), row.pxToBp(300))
  }
  view
    .rubberBandMenuItems()
    .find(item => item.label === 'Zoom to region(s)')!
    .onClick()
  expect(view.followAnchorIndex).toBe(0)
  expect(view.views.every(row => row.bpPerPx < 5)).toBe(true)
})

// Centering moves both rows of a level. Held where it was, the anchor would
// have the follow pull them straight back; as root actions it landed on the
// mate row. The feature's own row drives.
const CENTERED = {
  uniqueId: 'f',
  refName: 'ctgA',
  start: 1000,
  end: 2000,
  assemblyName: 'volvox1',
  mate: {
    refName: 'ctgA',
    start: 3000,
    end: 4000,
    assemblyName: 'volvox2',
  },
}

test("centering on a feature hands the anchor to the feature's own row", async () => {
  const view = await openStack()
  const problems = centerStackOnFeature({
    view,
    level: 1,
    feat: CENTERED,
    assemblyManager: getSession(view).assemblyManager,
  })
  expect(problems).toEqual([])
  expect(view.followAnchorIndex).toBe(1)
})

// The widget can sit open while its row is narrowed away from the feature, so
// that row's `navTo` throws and it stays put. Anchored anyway, it would have
// the follow pull the mate row, which did move, back to the unmoved one.
test('a row that could not center gives the anchor to the one that did', async () => {
  const view = await openStack()
  view.views[1]!.setDisplayedRegions([
    { assemblyName: 'volvox1', refName: 'ctgA', start: 8000, end: 16000 },
  ])
  const problems = centerStackOnFeature({
    view,
    level: 1,
    feat: CENTERED,
    assemblyManager: getSession(view).assemblyManager,
  })
  expect(problems).toHaveLength(1)
  expect(view.followAnchorIndex).toBe(2)
})

// The gesture set is a list of names, and a navigation the view grows that is
// in neither set is one of two silent defects: a gesture the follow undoes on
// the next settle, or a tail it takes the anchor on. So every navigation-shaped
// action the view actually has must be classified, one way or the other.
test('every navigation-shaped action of a row is classified', async () => {
  const view = await openStack()
  // matches of the shape test that do not navigate: a preference, a
  // decoration, a read, the rubber band's highlight, an animation's cancel
  const notNavigation = new Set([
    'setScrollZoom',
    'setShowCenterLine',
    'getSelectedRegions',
    'setOffsets',
    'cancelZoomAnimation',
  ])
  const shape =
    /scroll|zoom|^nav|moveTo|center|^fly|slide|fit|regions|window|offsets|newView|flip/i
  const actions = [...getMembers(view.views[0]!).actions]
  expect(actions.length).toBeGreaterThan(50)
  expect(
    actions.filter(
      name =>
        shape.test(name) &&
        !ROW_GESTURES.has(name) &&
        !ROW_NAVIGATIONS_HELD.has(name) &&
        !notNavigation.has(name),
    ),
  ).toEqual([])
  expect([...ROW_GESTURES].filter(name => !actions.includes(name))).toEqual([])
  expect(
    [...ROW_NAVIGATIONS_HELD].filter(name => !actions.includes(name)),
  ).toEqual([])
})

// A spec that opens following places its rows through the same navigations a
// search box would, one root action per row, and the anchor it named ended on
// whichever row navigated last.
test.each([0, 2])(
  'a spec that opens following keeps the anchor it named (%p)',
  async followAnchorIndex => {
    const view = await launchStack({
      views: [
        { assembly: 'volvox0', loc: 'ctgA:1-8000' },
        { assembly: 'volvox1' },
        { assembly: 'volvox2', displayedRegionNames: ['ctgA'] },
      ],
      followSynteny: true,
      followAnchorIndex,
    })
    expect(view.followSynteny).toBe(true)
    expect(view.followAnchorIndex).toBe(followAnchorIndex)
  },
)

// An appended row's own init navigates it as a root action — `navToLocString`
// with a `loc`, `showAllRegionsInAssembly` without — and the follow read that
// as a gesture on the new row, re-placing every existing row off its
// whole-genome window.
test.each([{ loc: 'ctgA:100-200' }, {}])(
  'a row appended while following does not take the anchor (%p)',
  async extra => {
    const view = await openStack()
    view.views[1]!.horizontalScroll(40)
    expect(view.followAnchorIndex).toBe(1)
    void view.appendRow({ assembly: 'volvox3', ...extra })
    await when(() => view.views.length === 4 && view.views[3]!.initialized)
    await when(() => view.views[3]!.displayedRegions.length > 0)
    expect(view.followAnchorIndex).toBe(1)
    // and once it is showing something, a gesture on it counts like any other
    view.views[3]!.horizontalScroll(40)
    expect(view.followAnchorIndex).toBe(3)
  },
)

test('off, a gesture takes nothing', async () => {
  const view = await openStack()
  view.setFollowSynteny(false)
  view.views[2]!.horizontalScroll(40)
  expect(view.followAnchorIndex).toBe(0)
})
