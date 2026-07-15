import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/breakpoint/config.json' with { type: 'json' }

setup()

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

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  fetchMock.mockResponse(async (request: Request) => {
    const url = request.url
    if (url.includes('jb2=true')) {
      return '{}'
    }
    return handleRequest(() => getFile(url), request)
  })
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearCache()
  clearAdapterCache()
  jest.restoreAllMocks()
})

function createBreakpointView(init: object) {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('BreakpointSplitView', { init })
  view.setWidth(800)
  return view
}

test('BreakpointSplitView initializes with init property', async () => {
  const view = createBreakpointView([
    { loc: 'chr3:186,700,000..186,701,000', assembly: 'hg19' },
    { loc: 'chr6:56,758,000..56,759,000', assembly: 'hg19' },
  ])

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
  const view = createBreakpointView([
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
  ])

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
  const view = createBreakpointView([
    { assembly: 'hg19' },
    { assembly: 'hg19' },
  ])

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
  const view = createBreakpointView([
    { loc: 'chr3:1..1000', assembly: 'hg19' },
    { loc: 'chr6:1..1000', assembly: 'hg19' },
  ])

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
  const view = rootModel.session!.addView('BreakpointSplitView', {})
  view.setWidth(800)

  expect(view.showImportForm).toBe(true)
  expect(view.hasSomethingToShow).toBe(false)
}, 40000)
