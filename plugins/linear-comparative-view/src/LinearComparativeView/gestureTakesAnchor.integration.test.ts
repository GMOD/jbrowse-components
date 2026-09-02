import { getMembers } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import {
  ROW_GESTURES,
  ROW_NAVIGATIONS_HELD,
} from '../SyntenyFollow/installSyntenyFollow.ts'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

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

// Three rows and no synteny track: what is under test is which row a gesture
// lands on, which the follow decides before any alignment is read.
async function openStack() {
  const session = createTestSession()
  const names = ['volvox0', 'volvox1', 'volvox2']
  for (const name of names) {
    session.addAssemblyConf(assembly(name))
  }
  const view = (await session.launchView('LinearSyntenyView', {
    views: names.map(name => ({ assembly: name, loc: 'ctgA:1-8000' })),
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length === 3 && view.views.every(v => v.initialized),
  )
  view.setRowSyncMode('follow')
  openViews.push({ session, view })
  return view
}

// The pixel lock lets any row drive the others, and under the follow a row
// that snapped back read as a bug — the snackbar that used to explain it
// offered exactly this, one drag too late.
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

test('a navigation held for the follow is not a gesture', async () => {
  const view = await openStack()
  view.holdFollowAnchor(() => {
    view.views[2]!.horizontalScroll(40)
    view.views[1]!.zoomTo(view.views[1]!.bpPerPx * 2)
  })
  expect(view.followAnchorIndex).toBe(0)
})

// the view-wide zooms reach every row from one of the stack's own actions,
// which nests the rows' zooms under it
test('a view-wide zoom is not one either', async () => {
  const view = await openStack()
  view.squareView()
  view.showAllRegionsAcrossRows(false)
  expect(view.followAnchorIndex).toBe(0)
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

test('off, a gesture takes nothing', async () => {
  const view = await openStack()
  view.setRowSyncMode('independent')
  view.views[2]!.horizontalScroll(40)
  expect(view.followAnchorIndex).toBe(0)
  view.setRowSyncMode('link')
  view.views[2]!.horizontalScroll(40)
  expect(view.followAnchorIndex).toBe(0)
})
