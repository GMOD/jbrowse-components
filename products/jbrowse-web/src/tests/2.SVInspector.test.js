// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { TextEncoder, TextDecoder } from 'web-encoding'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'

window.TextEncoder = TextEncoder
window.TextDecoder = TextDecoder

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

test('opens a vcf.gz file in the sv inspector view', async () => {
  console.warn = jest.fn()
  const pluginManager = getPluginManager()
  const { findByTestId, getByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  const {
    rootModel: { session },
  } = pluginManager
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('SV inspector'))

  fireEvent.change(await findByTestId('urlInput'), {
    target: { value: 'volvox.dup.renamed.vcf.gz' },
  })
  await waitFor(() =>
    expect(
      getByTestId('open_spreadsheet').closest('button'),
    ).not.toBeDisabled(),
  )
  fireEvent.click(await findByTestId('open_spreadsheet'))
  fireEvent.click(await findByTestId('chord-vcf-0', {}, { timeout: 10000 }))

  // confirm breakpoint split view opened
  expect(session.views.length).toBe(3)
  expect(session.views[2].displayName).toBe('bnd_A split detail')
}, 15000)
