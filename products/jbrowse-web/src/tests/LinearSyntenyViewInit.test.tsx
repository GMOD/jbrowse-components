import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import {
  grapePeachGetFile,
  utilizeFetchMockForTest,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(grapePeachGetFile)

async function createSyntenyViewWithInit(init: {
  views: { loc?: string; assembly: string; tracks?: string[] }[]
  tracks?: string[][]
}) {
  const { pluginManager, rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // Add a LinearSyntenyView with init property
  const view = session.addView('LinearSyntenyView', {
    init,
  })

  // Set width to trigger initialization
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('LinearSyntenyView initializes with init property', async () => {
  const { view } = await createSyntenyViewWithInit({
    views: [
      { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
      { loc: 'chr1:316,306..316,364', assembly: 'grape' },
    ],
    tracks: [['subset']],
  })

  // Initially should have hasSomethingToShow true due to init
  expect(view.hasSomethingToShow).toBe(true)

  // Wait for the view to initialize
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  // After initialization, should have 2 views
  expect(view.views.length).toBe(2)

  // Check that views have correct assemblies
  expect(view.views[0].assemblyNames[0]).toBe('peach')
  expect(view.views[1].assemblyNames[0]).toBe('grape')

  // Check that synteny track was loaded
  expect(view.levels[0]?.tracks.length).toBe(1)

  // init should be cleared after processing
  expect(view.init).toBeUndefined()
}, 40000)

test('LinearSyntenyView init without loc shows all regions', async () => {
  const { view } = await createSyntenyViewWithInit({
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
  })

  // Wait for the view to initialize
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  // Should have 2 views
  expect(view.views.length).toBe(2)

  // Views should have displayed regions (showing all regions)
  expect(view.views[0].displayedRegions.length).toBeGreaterThan(0)
  expect(view.views[1].displayedRegions.length).toBeGreaterThan(0)
}, 40000)

test('LinearSyntenyView showImportForm is false when init is set', async () => {
  const { view } = await createSyntenyViewWithInit({
    views: [
      { loc: 'Pp01:1..1000', assembly: 'peach' },
      { loc: 'chr1:1..1000', assembly: 'grape' },
    ],
  })

  // showImportForm should be false because hasSomethingToShow is true
  expect(view.showImportForm).toBe(false)
  expect(view.hasSomethingToShow).toBe(true)

  // Wait for async operations to settle
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
}, 40000)

// Regression: a snapshot taken before views materialize must keep init, so a
// reload/restore (e.g. autosave firing mid-load) can rebuild the view instead
// of stranding on the import form. Once views exist, init is redundant and
// stripped.
test('snapshot keeps init while views empty, strips it once materialized', async () => {
  const { view } = await createSyntenyViewWithInit({
    views: [
      { loc: 'Pp01:1..1000', assembly: 'peach' },
      { loc: 'chr1:1..1000', assembly: 'grape' },
    ],
    tracks: [['subset']],
  })

  // mid-load: views not built yet, snapshot must still carry init
  expect(view.views.length).toBe(0)
  const before: { init?: unknown } = getSnapshot(view)
  expect(before.init).toBeDefined()

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  // materialized: views present, init dropped from the snapshot
  expect(view.views.length).toBe(2)
  const after: { init?: unknown } = getSnapshot(view)
  expect(after.init).toBeUndefined()
}, 40000)

test('LinearSyntenyView showImportForm is true when no init and no views', () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // Add a LinearSyntenyView without init property
  const view = session.addView('LinearSyntenyView', {})

  // showImportForm should be true because hasSomethingToShow is false
  expect(view.showImportForm).toBe(true)
  expect(view.hasSomethingToShow).toBe(false)
}, 40000)
