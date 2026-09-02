import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  return session
}

// A row's loc is parsed by navToLocString, which throws on an unknown refName.
// It runs inside a Promise.all over the rows, so before the per-row catch one
// typo rejected the whole thing, landed in the init catch, and setError dropped
// every row that had loaded fine back to the import form.
test('a bad per-row init loc keeps the built rows', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  const view = (await session.launchView('LinearSyntenyView', {
    views: [
      { assembly: 'volvox', loc: 'nonexistent:1-2' },
      { assembly: 'volvox2', loc: 'ctgA:5000-15000' },
    ],
  })) as LinearSyntenyViewModel
  view.setWidth(800)

  await when(() => view.pendingLaunch === undefined)

  expect(view.views).toHaveLength(2)
  // the row with the good loc still navigated
  expect(view.views[1]!.offsetPx).toBeGreaterThan(0)
  // and the view stayed usable rather than falling back to the import form
  expect(view.error).toBeUndefined()
  expect(view.showImportForm).toBe(false)
  expect(view.status).toEqual({ type: 'ready' })
  expect(notifyError).toHaveBeenCalledTimes(1)
})

// The other side of the same policy: a failure before setViews lands leaves
// nothing on screen, so `init` is kept (it is persisted while views is empty)
// and the error goes to the import form's banner instead of a snackbar.
test('an unloadable assembly keeps init and shows the import form', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'volvox' }, { assembly: 'nope' }],
  })) as LinearSyntenyViewModel
  view.setWidth(800)

  await when(() => !!view.error)

  expect(view.views).toHaveLength(0)
  // kept, so a reload can retry it
  expect(view.pendingLaunch).toBeDefined()
  expect(view.showImportForm).toBe(true)
  // `initialized` waits on every row, so it is false here and stays false — a
  // host gating on it draws an empty box for as long as the tab is open, with
  // nothing anywhere naming the assembly that failed. `status` carries it.
  expect(view.initialized).toBe(false)
  expect(view.status).toEqual({ type: 'error', error: view.error })
  // the banner is the whole report — no duplicate snackbar
  expect(notifyError).not.toHaveBeenCalled()
})

// The third outcome, and the one a host is most likely to mistake for ready: no
// rows and no `init` is a synteny view nobody has told what to compare, which
// is what JBrowse's own apps draw the import form for.
test('no rows and no init is noRegions', async () => {
  const session = setup()
  const view = (await session.launchView(
    'LinearSyntenyView',
    {},
  )) as LinearSyntenyViewModel
  view.setWidth(800)

  expect(view.hasSomethingToShow).toBe(false)
  expect(view.status).toEqual({ type: 'noRegions' })
  expect(view.showImportForm).toBe(true)
})
