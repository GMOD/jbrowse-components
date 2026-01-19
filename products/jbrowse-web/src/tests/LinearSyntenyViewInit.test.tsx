import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }

setup()

console.warn = jest.fn()
console.error = jest.fn()

// Suppress mobx reaction errors during test teardown
configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  // Handle relative URLs from the grape_peach_synteny config
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  // If the URL doesn't start with test_data, assume it's relative to grape_peach_synteny
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/grape_peach_synteny/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

async function createSyntenyViewWithInit(init: {
  views: { loc?: string; assembly: string; tracks?: string[] }[]
  tracks?: string[]
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
    tracks: ['subset'],
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
