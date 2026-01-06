import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

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

async function createLinearGenomeViewWithInit(init: {
  loc?: string
  assembly: string
  tracks?: string[]
  tracklist?: boolean
  nav?: boolean
  highlight?: string[]
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('LinearGenomeView', { init })
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('LinearGenomeView initializes with init property and location', async () => {
  const { view } = await createLinearGenomeViewWithInit({
    loc: 'ctgA:1..1000',
    assembly: 'volvox',
  })

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

test('LinearGenomeView initializes with init property and tracks', async () => {
  const { view } = await createLinearGenomeViewWithInit({
    loc: 'ctgA:1..1000',
    assembly: 'volvox',
    tracks: ['volvox_filtered_vcf'],
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

test('LinearGenomeView initializes without location shows all regions', async () => {
  const { view } = await createLinearGenomeViewWithInit({
    assembly: 'volvox',
  })

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

test('LinearGenomeView initializes with tracklist and nav options', async () => {
  const { view } = await createLinearGenomeViewWithInit({
    assembly: 'volvox',
    loc: 'ctgA:1..1000',
    tracklist: true,
    nav: false,
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      // Wait for init to be cleared - autorun is async so we need to wait for
      // all init operations to complete
      expect(view.init).toBeUndefined()
    },
    { timeout: 30000 },
  )

  expect(view.hideHeader).toBe(true)
}, 40000)

test('LinearGenomeView showImportForm is false when init is set', async () => {
  const { view } = await createLinearGenomeViewWithInit({
    assembly: 'volvox',
    loc: 'ctgA:1..1000',
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

test('LinearGenomeView without init shows import form', () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('LinearGenomeView', {})

  expect(view.displayedRegions.length).toBe(0)
  expect(view.init).toBeUndefined()
}, 40000)
