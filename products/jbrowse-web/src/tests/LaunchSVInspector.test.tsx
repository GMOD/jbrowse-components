import { render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

test('can use a spec url for sv inspector view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgB:1,982', {}, delay)
}, 40000)
