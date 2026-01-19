import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/breakpoint/config.json' with { type: 'json' }

setup()

console.warn = jest.fn()
console.error = jest.fn()

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

beforeEach(() => {
  // @ts-expect-error
  fetch.mockResponse(async (request: Request) => {
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
})

test('BreakpointSplitView init without loc shows all regions', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('BreakpointSplitView', {
    init: {
      views: [{ assembly: 'hg19' }, { assembly: 'hg19' }],
    },
  })
  view.setWidth(800)

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
