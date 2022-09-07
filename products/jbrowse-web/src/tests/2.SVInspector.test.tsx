import '@testing-library/jest-dom/extend-expect'
import { fireEvent, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { TextEncoder, TextDecoder } from 'web-encoding'

import { setup, createView, generateReadBuffer } from './util'

window.TextEncoder = TextEncoder
window.TextDecoder = TextDecoder

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

const delay = { timeout: 20000 }

test('opens a vcf.gz file in the sv inspector view', async () => {
  console.warn = jest.fn()
  const { session, findByTestId, getByTestId, findByText } = createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('SV inspector'))

  fireEvent.change(await findByTestId('urlInput', {}, delay), {
    target: { value: 'volvox.dup.renamed.vcf.gz' },
  })
  await waitFor(() =>
    expect(
      getByTestId('open_spreadsheet').closest('button'),
    ).not.toBeDisabled(),
  )
  fireEvent.click(await findByTestId('open_spreadsheet'))
  fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

  // confirm breakpoint split view opened
  expect(session.views.length).toBe(3)
  expect(session.views[2].displayName).toBe('bnd_A split detail')
}, 30000)
