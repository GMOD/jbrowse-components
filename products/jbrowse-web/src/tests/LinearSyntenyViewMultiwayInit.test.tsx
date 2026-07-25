import { waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

test('multi-way LinearSyntenyView init routes tracks to per-level slots', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // 3 assemblies — so 2 levels (between views[0]/[1] and views[1]/[2]).
  // volvox_del.paf maps volvox_del↔volvox  → level 0
  // volvox_ins.paf maps volvox↔volvox_ins  → level 1
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox_del' },
        { assembly: 'volvox' },
        { assembly: 'volvox_ins' },
      ],
      tracks: [['volvox_del.paf'], ['volvox_ins.paf']],
    },
  })

  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.views.length).toBe(3)
  expect(view.levels.length).toBe(2)

  // The fix: each PAF lands at its correct level rather than both at level 0.
  expect(view.levels[0]?.tracks.length).toBe(1)
  expect(view.levels[1]?.tracks.length).toBe(1)
  expect(view.levels[0]?.tracks[0]?.configuration.trackId).toBe(
    'volvox_del.paf',
  )
  expect(view.levels[1]?.tracks[0]?.configuration.trackId).toBe(
    'volvox_ins.paf',
  )

  expect(view.init).toBeUndefined()
}, 40000)

test('a hand-authored multi-way session sizes levels from its views', () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // three genome rows written out directly: no `init` to build them and no
  // `levels` key, the shape a hand-authored defaultSession takes. Without the
  // load-time reconcile this rendered a single synteny band between the first
  // two rows and nothing between the last pair.
  const view = session.addView('LinearSyntenyView', {
    views: [
      { type: 'LinearGenomeView', init: { assembly: 'volvox_del' } },
      { type: 'LinearGenomeView', init: { assembly: 'volvox' } },
      { type: 'LinearGenomeView', init: { assembly: 'volvox_ins' } },
    ],
  })

  expect(view.levels.length).toBe(2)
  expect(view.levels[0]?.level).toBe(0)
  expect(view.levels[1]?.level).toBe(1)
})

test('a failed init lands on the import form, not a permanent spinner', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'no_such_assembly' }, { assembly: 'volvox' }],
    },
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.error).toBeTruthy()
    },
    { timeout: 30000 },
  )
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(true)
  // kept so a reload can retry the init from a clean slate
  expect(view.init).toBeDefined()

  // ...and "return to import form" drops it, so the view can't bounce back to
  // the spinner
  view.clearView()
  expect(view.init).toBeUndefined()
  expect(view.showImportForm).toBe(true)
}, 40000)
