import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer'
import { getPluginManager, setup } from './util'
import configSnapshot from '../../test_data/breakpoint/config.json'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  if (cleanUrl.includes('hg19.chrom.sizes')) {
    return new LocalFile(require.resolve(`../../test_data/hg19.chrom.sizes`))
  }
  if (cleanUrl.includes('hg19_aliases')) {
    return new LocalFile(
      require.resolve(`../../test_data/hg19_aliases_chr.txt`),
    )
  }
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/breakpoint/${cleanUrl}`
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

async function createBreakpointSplitViewWithInit(init: {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
}) {
  const { pluginManager, rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('BreakpointSplitView', { init })
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('BreakpointSplitView initializes with init property', async () => {
  const { view } = await createBreakpointSplitViewWithInit({
    views: [
      { loc: 'chr3:186,700,000..186,701,000', assembly: 'hg19' },
      { loc: 'chr6:56,758,000..56,759,000', assembly: 'hg19' },
    ],
  })

  expect(view.hasSomethingToShow).toBe(true)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.views.length).toBe(2)
  expect(view.views[0].assemblyNames[0]).toBe('hg19')
  expect(view.views[1].assemblyNames[0]).toBe('hg19')
  expect(view.init).toBeUndefined()
}, 40000)

test('BreakpointSplitView initializes with tracks', async () => {
  const { view } = await createBreakpointSplitViewWithInit({
    views: [
      {
        loc: 'chr3:186,700,000..186,701,000',
        assembly: 'hg19',
        tracks: ['pacbio_vcf'],
      },
      {
        loc: 'chr6:56,758,000..56,759,000',
        assembly: 'hg19',
        tracks: ['pacbio_vcf'],
      },
    ],
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.views.length).toBe(2)
  expect(view.views[0].tracks.length).toBe(1)
  expect(view.views[1].tracks.length).toBe(1)
  expect(view.init).toBeUndefined()
}, 40000)

test('BreakpointSplitView init without loc shows all regions', async () => {
  const { view } = await createBreakpointSplitViewWithInit({
    views: [{ assembly: 'hg19' }, { assembly: 'hg19' }],
  })

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  expect(view.views.length).toBe(2)
  expect(view.views[0].displayedRegions.length).toBeGreaterThan(0)
  expect(view.views[1].displayedRegions.length).toBeGreaterThan(0)
}, 40000)

test('BreakpointSplitView showImportForm is false when init is set', async () => {
  const { view } = await createBreakpointSplitViewWithInit({
    views: [
      { loc: 'chr3:1..1000', assembly: 'hg19' },
      { loc: 'chr6:1..1000', assembly: 'hg19' },
    ],
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

test('BreakpointSplitView showImportForm is true when no init', () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('BreakpointSplitView', {})

  expect(view.showImportForm).toBe(true)
  expect(view.hasSomethingToShow).toBe(false)
}, 40000)
