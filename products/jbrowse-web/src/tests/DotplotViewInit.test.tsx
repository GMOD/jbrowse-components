import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }
import {
  grapePeachGetFile,
  utilizeFetchMockForTest,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(grapePeachGetFile)

async function createDotplotViewWithInit(init: {
  views: { assembly: string }[]
  tracks?: string[]
}) {
  const { pluginManager, rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('DotplotView', { init })
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('DotplotView initializes with init property', async () => {
  const { view } = await createDotplotViewWithInit({
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
    tracks: ['subset'],
  })

  expect(view.hasSomethingToShow).toBe(true)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames).toContain('peach')
  expect(view.assemblyNames).toContain('grape')
  expect(view.init).toBeUndefined()
}, 40000)

test('DotplotView initializes without tracks', async () => {
  const { view } = await createDotplotViewWithInit({
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames).toContain('peach')
  expect(view.assemblyNames).toContain('grape')
  expect(view.init).toBeUndefined()
}, 40000)

test('DotplotView showImportForm is false when init is set', async () => {
  const { view } = await createDotplotViewWithInit({
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
  })

  expect(view.showImportForm).toBe(false)
  expect(view.hasSomethingToShow).toBe(true)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
}, 40000)

test('DotplotView showImportForm is true when no init', () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('DotplotView', {})

  expect(view.hasSomethingToShow).toBe(false)
}, 40000)

test('DotplotView can re-initialize with different assemblies', async () => {
  const { view } = await createDotplotViewWithInit({
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames).toEqual(['peach', 'grape'])
  expect(view.hview.displayedRegions.length).toBeGreaterThan(0)
  expect(view.vview.displayedRegions.length).toBeGreaterThan(0)

  view.setAssemblyNames('grape', 'peach')

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames).toEqual(['grape', 'peach'])
  expect(view.hview.displayedRegions.length).toBeGreaterThan(0)
  expect(view.vview.displayedRegions.length).toBeGreaterThan(0)
  expect(view.showLoading).toBe(false)
}, 40000)

// Regression: a snapshot taken before the view materializes (e.g. autosave
// firing while the init autorun hasn't set assemblyNames yet) must keep init,
// so a reload/restore rebuilds instead of stranding on the import form. Once
// assemblyNames are set, init is redundant and stripped.
test('snapshot keeps init until assemblyNames set, strips it after', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('DotplotView', {
    init: { views: [{ assembly: 'peach' }, { assembly: 'grape' }] },
  })

  // no width yet -> init autorun hasn't run
  expect(view.assemblyNames.length).toBe(0)
  const before: { init?: unknown } = getSnapshot(view)
  expect(before.init).toBeDefined()

  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames.length).toBe(2)
  const after: { init?: unknown } = getSnapshot(view)
  expect(after.init).toBeUndefined()
}, 40000)
