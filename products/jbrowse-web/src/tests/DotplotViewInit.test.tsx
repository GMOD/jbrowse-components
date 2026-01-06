import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
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

  expect(view.showImportForm).toBe(true)
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
