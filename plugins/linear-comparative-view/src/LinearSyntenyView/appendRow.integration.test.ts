import { createTestSession } from '@jbrowse/web/testUtils'
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
  const view = session.addView('LinearSyntenyView', {
    init: { views: names.map(assembly => ({ assembly })) },
  }) as LinearSyntenyViewModel
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
  expect(heights(view)).toEqual([64, 64, 64, 64, 64])

  view.appendRow({ assembly: 'volvox0' })
  expect(heights(view)).toEqual([64, 64, 64, 64, 64, 64])
})

// A band the user dragged is the height they chose for this stack; the row they
// add below it must not come in at the factory default either.
test('an appended level matches a hand-resized stack', async () => {
  const { view } = await openStack(2)
  view.levels[0]!.setHeight(210)

  view.appendRow({ assembly: 'volvox0' })
  expect(heights(view)).toEqual([210, 210])
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

  view.appendRow({ assembly: 'volvox0', syntenyTrackId: 'uploaded' })

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
    .flatMap(item => ('subMenu' in item ? item.subMenu : [item]))
    .map(item => ('label' in item ? item.label : ''))

// A row is appended to the stack the user is looking at, and the import form is
// what they are looking at when there is no stack. Anchored to a view with no
// rows, the dialog read the bottom row's assembly as '' — which matches every
// synteny dataset in the session rather than none — and appending then showed
// the chosen one on a level that does not exist.
test('the header menu offers Add assembly row only once there is a row', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox0'))
  const empty = session.addView('LinearSyntenyView') as LinearSyntenyViewModel
  openViews.push({ session, view: empty })

  expect(empty.showImportForm).toBe(true)
  expect(menuLabels(empty)).not.toContain('Add assembly row...')

  const { view } = await openStack(2)
  expect(menuLabels(view)).toContain('Add assembly row...')
})
