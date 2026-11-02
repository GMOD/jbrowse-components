import { getSession } from '@jbrowse/core/util'
import { showRegionsWithUndo } from '@jbrowse/plugin-linear-genome-view'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { centerStackOnFeature } from '../SyntenyFeatureDetail/centerOnFeature.ts'

import type { LinearSyntenyViewModel } from './model.ts'

type WebSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// none.paf reads as an empty file: the anchor needs the track, not its rows
beforeEach(() => {
  fetchMock.mockResponse('')
})

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
// under test is which row leads, which the follow decides before
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

// A followed row that snapped back after a drag read as a bug. Which row was
// touched is the row's own handler's to say (`RowTouchArea.test.tsx`); this is
// what the stack does with it.
test('touching a followed row makes it the anchor', async () => {
  const view = await openStack()
  expect(view.followAnchorIndex).toBe(0)
  view.rowTouched(2)
  expect(view.followAnchorIndex).toBe(2)
  view.rowTouched(1)
  expect(view.followAnchorIndex).toBe(1)
})

test('touching the anchor row changes nothing', async () => {
  const view = await openStack()
  view.rowTouched(0)
  expect(view.followAnchorIndex).toBe(0)
})

test('off, a touch takes nothing', async () => {
  const view = await openStack()
  view.setFollowSynteny(false)
  view.rowTouched(2)
  expect(view.followAnchorIndex).toBe(0)
})

// The anchor is a setting, and only a touch or a call to set it moves it: a
// script that navigates a followed row moves that row alone
test("a script's navigation of a followed row leaves the anchor where it was", async () => {
  const view = await openStack()
  const row = view.views[2]!
  row.horizontalScroll(40)
  view.views[1]!.zoomTo(view.views[1]!.bpPerPx * 2)
  await row.navToLocString('ctgA:100-200')
  showRegionsWithUndo({
    view: row,
    regions: [
      { assemblyName: 'volvox2', refName: 'ctgA', start: 1000, end: 2000 },
    ],
    message: 'Collapsed introns',
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

test('a view-wide zoom leaves the anchor where it was', async () => {
  const view = await openStack()
  view.squareView()
  view.showAllRegionsAcrossRows(false)
  expect(view.followAnchorIndex).toBe(0)
})

test("the stack's rubber-band zoom leaves the anchor where it was", async () => {
  const view = await openStack()
  for (const row of view.views) {
    row.setOffsets(row.pxToBp(100), row.pxToBp(300))
  }
  const zoom = view
    .rubberBandMenuItems()
    .find(item => 'onClick' in item && item.label === 'Zoom to region(s)')
  ;(zoom as { onClick: () => void }).onClick()
  expect(view.followAnchorIndex).toBe(0)
  expect(view.views.every(row => row.bpPerPx < 5)).toBe(true)
})

// Centering moves both rows of a level. Left where it was, the anchor would
// have the follow pull them straight back. The feature's own row drives.
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

test.each([0, 2])(
  'a spec that opens following keeps the anchor it named (%p)',
  async followAnchorIndex => {
    const view = await launchStack({
      views: [
        { assembly: 'volvox0', loc: 'ctgA:1-8000' },
        { assembly: 'volvox1' },
        { assembly: 'volvox2', displayedRegionNames: ['ctgA'] },
      ],
      navigation: { follow: true, anchor: followAnchorIndex },
    })
    expect(view.followSynteny).toBe(true)
    expect(view.followAnchorIndex).toBe(followAnchorIndex)
  },
)

// An appended row's own init navigates it, `navToLocString` with a `loc` and
// `showAllRegionsInAssembly` without
test.each([{ loc: 'ctgA:100-200' }, {}])(
  'a row appended while following does not take the anchor (%p)',
  async extra => {
    const view = await openStack()
    view.rowTouched(1)
    void view.appendRow({ assembly: 'volvox3', ...extra })
    await when(() => view.views.length === 4 && view.views[3]!.initialized)
    await when(() => view.views[3]!.displayedRegions.length > 0)
    expect(view.followAnchorIndex).toBe(1)
    view.rowTouched(3)
    expect(view.followAnchorIndex).toBe(3)
  },
)
