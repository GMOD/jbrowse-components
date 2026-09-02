import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

type WebSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Showing a synteny track starts a real fetch through the main-thread RPC
// driver, and these tests assert on layout rather than on data, so each one
// ended with that fetch still in flight. Jest then tore the module registry
// down under it, the driver's lazy require failed, and the autorun's catch
// logged it — `isCurrent()` folds in `isAlive`, so a view nobody closed still
// counts as current. Closing it is what the app does and closes that guard, so
// the late rejection lands on the floor where it belongs.
//
// Worth fixing here rather than filtering in `config/jest/console.js`: a
// genuine post-teardown error reads exactly like this one, and a filter would
// leave nothing to tell them apart.
let openViews: { session: WebSession; view: LinearSyntenyViewModel }[] = []

afterEach(() => {
  for (const { session, view } of openViews) {
    session.removeView(view)
  }
  openViews = []
})

// Both shapes this suite provokes go through `console.error`: the adapter
// failure above, and the `no session model found!` a fetch still in flight
// raises once `afterEach` has taken its view out — `removeView` detaches rather
// than destroys (ADR-069), so the fetch's `isCurrent` guard still reads the
// display as alive and reports. Taken here; anything else still prints, so the
// contract gate keeps working.
const provoked = /Offset is outside the bounds|no session model found/
let reported: jest.SpyInstance
beforeAll(() => {
  const print = console.error
  reported = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      if (!provoked.test(args.map(a => `${a}`).join(' '))) {
        print(...args)
      }
    })
})
afterAll(() => {
  expect(reported).toHaveBeenCalled()
  reported.mockRestore()
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

// `rowCount` assemblies chained by a synteny track between each adjacent pair,
// so the view opens with rowCount-1 levels the way a multi-way launch would.
async function openStack(rowCount: number) {
  const session = createTestSession()
  const names = Array.from({ length: rowCount }, (_, i) => `volvox${i}`)
  for (const name of names) {
    session.addAssemblyConf(assembly(name))
  }
  for (let i = 0; i < rowCount - 1; i++) {
    session.addSessionTrackConf({
      type: 'SyntenyTrack',
      trackId: `synteny${i}`,
      name: `synteny${i}`,
      assemblyNames: [names[i], names[i + 1]],
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
        queryAssembly: names[i],
        targetAssembly: names[i + 1],
      },
    })
  }
  const view = (await session.launchView('LinearSyntenyView', {
    views: names.map(assembly => ({ assembly })),
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  await when(() => view.levels.length === rowCount - 1)
  openViews.push({ session, view })
  return { session, view }
}

const heights = (view: LinearSyntenyViewModel) => view.levels.map(l => l.height)

// The band budget splits 320px across the levels, so a launched 6-row stack
// opens at 64px a band. Appending a row is the third way a level comes into
// existence and has to land on the same number the other two do.
test('an appended level matches the auto-scaled stack it joins', async () => {
  const { view } = await openStack(6)
  // the init tracks land through the async launchTrack path now, and the
  // auto-scale follows them
  await waitFor(() => {
    expect(heights(view)).toEqual([64, 64, 64, 64, 64])
  })

  await view.appendRow({ assembly: 'volvox0' })
  await waitFor(() => {
    expect(heights(view)).toEqual([64, 64, 64, 64, 64, 64])
  })
})

// A band the user dragged is the height they chose for this stack; the row they
// add below it must not come in at the factory default either.
test('an appended level matches a hand-resized stack', async () => {
  const { view } = await openStack(2)
  // settle the launch first: its tracks land through the async launchTrack path
  // and the auto-scale follows them, so a height set before that is one the
  // init pass still overwrites. A pairwise stack auto-scales to the 100 default.
  await waitFor(() => {
    expect(heights(view)).toEqual([100])
  })
  view.levels[0]!.setHeight(210)

  await view.appendRow({ assembly: 'volvox0' })
  expect(heights(view)).toEqual([210, 210])
})

// The bars between the rows size the stack, not one gap: a multi-way view is
// read as one picture, so a drag on any of them moves every band by the same px.
// The differences a user already put between the bands survive it, which setting
// them all to one height would not.
test('a band drag resizes every band by the same amount', async () => {
  const { view } = await openStack(4)
  expect(heights(view)).toEqual([100, 100, 100])
  view.levels[1]!.setHeight(120)

  view.resizeAllLevelHeights(30)
  expect(heights(view)).toEqual([130, 150, 130])

  view.resizeAllLevelHeights(-30)
  expect(heights(view)).toEqual([100, 120, 100])
})

// Alt on the press is the way back to a stack whose bands differ on purpose, so
// the per-level drag has to leave its neighbours exactly where they were.
test('an alt-drag resizes only the band it was started on', async () => {
  const { view } = await openStack(4)
  expect(heights(view)).toEqual([100, 100, 100])

  view.levels[1]!.resizeHeight(40)
  expect(heights(view)).toEqual([100, 140, 100])

  // and it clamps on its own floor, without touching the others
  view.levels[1]!.resizeHeight(-1000)
  expect(heights(view)).toEqual([100, 20, 100])
})

// The floor is what keeps the bar itself grabbable, and it is per level: a drag
// that takes the stack down cannot leave one band with no bar to drag back.
test('a band drag stops at the height that keeps its bar grabbable', async () => {
  const { view } = await openStack(3)
  view.resizeAllLevelHeights(-1000)
  expect(heights(view)).toEqual([20, 20])

  view.resizeAllLevelHeights(15)
  expect(heights(view)).toEqual([35, 35])
})

// The dialog's custom-upload path adds the track conf and appends the row in
// one tick, so the level has to resolve a trackId the session gained a moment
// earlier — and the new level is materialized by the same action that shows the
// track on it.
test('a track added in the same tick shows on the level it was added for', async () => {
  const { session, view } = await openStack(2)
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'uploaded',
    name: 'uploaded',
    assemblyNames: ['volvox1', 'volvox0'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox1',
      targetAssembly: 'volvox0',
    },
  })

  await view.appendRow({ assembly: 'volvox0', syntenyTrackId: 'uploaded' })

  expect(view.levels.length).toBe(2)
  // on the new level, not the one that was already there (openStack configures
  // its datasets but shows none, so level 0 starts and stays empty)
  expect(view.levels[1]!.tracks.length).toBe(1)
  expect(view.levels[0]!.tracks.length).toBe(0)
})

// flattened one level: the row-management commands live in the "Rows" group
const menuLabels = (view: LinearSyntenyViewModel) =>
  view
    .headerMenuItems()
    .flatMap(item => ('subMenu' in item ? resolveSubMenu(item) : [item]))
    .map(item => ('label' in item ? item.label : ''))

// A row is appended to the stack the user is looking at, and the import form is
// what they are looking at when there is no stack. Anchored to a view with no
// rows, the dialog read the bottom row's assembly as '' — which matches every
// synteny dataset in the session rather than none — and appending then showed
// the chosen one on a level that does not exist.
test('the header menu offers Add assembly row only once there is a row', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox0'))
  const empty = (await session.launchView(
    'LinearSyntenyView',
  )) as LinearSyntenyViewModel
  openViews.push({ session, view: empty })

  expect(empty.showImportForm).toBe(true)
  expect(menuLabels(empty)).not.toContain('Add assembly row...')

  const { view } = await openStack(2)
  expect(menuLabels(view)).toContain('Add assembly row...')
})

// A six-row stack is the case that would grow the top level, so it is the one
// worth asserting on.
test('the header menu opens the same six rows at any row count', async () => {
  const { view } = await openStack(6)
  expect(
    view.headerMenuItems().map(item => ('label' in item ? item.label : '')),
  ).toEqual([
    'Square view - average bp per pixel',
    'Show all regions - each row fit to width',
    'Show all regions - same bp per pixel',
    'Sync rows',
    'Rows',
    'Export SVG',
  ])
})
