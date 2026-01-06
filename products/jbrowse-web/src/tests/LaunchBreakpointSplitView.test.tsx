import { render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

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
  return new LocalFile(
    require.resolve(`../../${cleanUrl.replace(/http:\/\/localhost\//, '')}`),
  )
}

const delay = { timeout: 20000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

test('can use a spec url for breakpoint split view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"BreakpointSplitView","views":[{"loc":"ctgA:1-5000","assembly":"volvox"},{"loc":"ctgB:1-5000","assembly":"volvox"}]}]}' />,
  )

  await findByText('ctgA', {}, delay)
  await findByText('ctgB', {}, delay)
}, 40000)
