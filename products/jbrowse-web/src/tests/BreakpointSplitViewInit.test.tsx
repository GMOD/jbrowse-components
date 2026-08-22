import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import configSnapshot from '../../test_data/breakpoint/config.json' with { type: 'json' }
import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

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

// An EMPTY session, not the config's `defaultSession`. That default is a
// pre-built BreakpointSplitView carrying pacbio_hg002_breakpoints and pacbio_vcf
// on both of its rows, and nothing in this file looks at it — every test adds
// its own view. What it did instead was start four display fetches per test that
// no test waits for, so they were still in flight when jest tore the environment
// down and the RPC's dynamic import landed on a dead module registry:
//
//   ReferenceError: You are trying to `require` a file after the Jest
//   environment has been torn down. From BreakpointSplitViewInit.test.tsx
//
// which is not just noise — an async rejection with no owner is attributed to
// whichever test happens to be running, so it turns a clean suite into an
// intermittently red one somewhere else.
async function createBreakpointView(init: object) {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setSession({ name: 'BreakpointSplitViewInit test' })
  const session = rootModel.session!
  const view = await session.launchView('BreakpointSplitView', { init })
  view.setWidth(800)
  return view
}

// Same channel LGV/dotplot/synteny/circular report on. Before the sub-views
// exist `init` is what names the assemblies; once they do, the wait belongs to
// the first uninitialized LGV and this delegates to the one it already computes.
test('BreakpointSplitView loadingMessage reports what the assembly load is downloading', async () => {
  const view = await createBreakpointView([
    { loc: 'chr3:186,700,000..186,701,000', assembly: 'hg19' },
    { loc: 'chr6:56,758,000..56,759,000', assembly: 'hg19' },
  ])

  expect(view.showLoading).toBe(true)
  expect(view.loadingMessage).toBe('Loading')

  // one synchronous block: the real load is in flight and its `finally` clears
  // the status, so anything after an await races it
  const asm = view.loadingAssembly!
  asm.setStatus({
    message: 'Downloading chromosome sizes',
    current: 3,
    total: 4,
  })
  expect(view.loadingMessage).toBe('Downloading chromosome sizes')
  expect(view.loadingProgress).toBe(0.75)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )

  // loaded: no spinner, so nothing to label
  expect(view.loadingMessage).toBeUndefined()
  expect(view.loadingProgress).toBeUndefined()
}, 40000)

test('BreakpointSplitView initializes with init property', async () => {
  const view = await createBreakpointView([
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
  const view = await createBreakpointView([
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
  const view = await createBreakpointView([
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
  const view = await createBreakpointView([
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

test('BreakpointSplitView showImportForm is true when no init', async () => {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setSession({ name: 'BreakpointSplitViewInit test' })
  const view = await rootModel.session!.launchView('BreakpointSplitView', {})
  view.setWidth(800)

  expect(view.showImportForm).toBe(true)
  expect(view.hasSomethingToShow).toBe(false)
}, 40000)
