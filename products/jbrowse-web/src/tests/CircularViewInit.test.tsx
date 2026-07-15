import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import {
  handleRequest,
  utilizeFetchMockForTest,
  volvoxGetFile,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

async function createCircularViewWithInit(init: {
  assembly: string
  tracks?: string[]
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('CircularView', { init })
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('CircularView initializes with init property', async () => {
  const { view } = await createCircularViewWithInit({
    assembly: 'volvox',
  })

  expect(view.hasSomethingToShow).toBe(true)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.assemblyNames[0]).toBe('volvox')
  expect(view.displayedRegions.length).toBeGreaterThan(0)
  expect(view.init).toBeUndefined()
}, 40000)

test('CircularView initializes with tracks', async () => {
  const { view } = await createCircularViewWithInit({
    assembly: 'volvox',
    tracks: ['volvox_sv_test'],
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.tracks.length).toBe(1)
  expect(view.init).toBeUndefined()
}, 40000)

test('CircularView showImportForm is false when init is set', async () => {
  const { view } = await createCircularViewWithInit({
    assembly: 'volvox',
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

test('CircularView showImportForm is true when no init', () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('CircularView', {})

  expect(view.showImportForm).toBe(true)
  expect(view.hasSomethingToShow).toBe(false)
}, 40000)

test('CircularView init with 404 TwoBitAdapter shows error', async () => {
  const config404 = {
    assemblies: [
      {
        name: 'nonexistent',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'nonexistent_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: {
              uri: 'nonexistent.2bit',
              locationType: 'UriLocation',
            },
          },
        },
      },
    ],
    configuration: {
      rpc: {
        defaultDriver: 'MainThreadRpcDriver',
      },
    },
  }

  // Mock fetch to return 404 for the nonexistent file
  jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
    if (`${url}`.includes('nonexistent.2bit')) {
      return new Response('Not Found', { status: 404 })
    }
    if (`${url}`.includes('jb2=true')) {
      return new Response('{}')
    }
    return handleRequest(() => volvoxGetFile(`${url}`), args)
  })

  const { rootModel } = getPluginManager(config404)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('CircularView', {
    init: {
      assembly: 'nonexistent',
    },
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.error).toBeTruthy()
    },
    { timeout: 30000 },
  )

  expect(`${view.error}`).toMatch(/404|not found|failed/i)
}, 40000)

// Regression: a snapshot taken before the view materializes (e.g. autosave
// firing while the init autorun hasn't set displayedRegions yet) must keep
// init, so a reload/restore rebuilds instead of stranding on the import form.
// Once displayedRegions exist, init is redundant and stripped.
test('snapshot keeps init while not materialized, strips it once regions load', async () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('CircularView', {
    init: { assembly: 'volvox' },
  })

  // no width yet -> init autorun hasn't set displayedRegions
  expect(view.displayedRegions.length).toBe(0)
  const before: { init?: unknown } = getSnapshot(view)
  expect(before.init).toBeDefined()

  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.displayedRegions.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  const after: { init?: unknown } = getSnapshot(view)
  expect(after.init).toBeUndefined()
}, 40000)
