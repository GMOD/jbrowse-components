import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer'
import { getPluginManager, setup } from './util'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
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
