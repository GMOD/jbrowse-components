// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render } from '@testing-library/react'
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

test('opens a vcf.gz file in the spreadsheet view', async () => {
  const pluginManager = getPluginManager()
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Spreadsheet view'))

  await findByTestId('spreadsheet_view_open')
  fireEvent.click(await findByText('URL'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: { value: 'volvox.filtered.vcf.gz' },
  })

  fireEvent.click(await findByTestId('open_spreadsheet'))
  fireEvent.click(await findByText('ctgA:9602..9603'))
  expect(pluginManager.rootModel.session.views.length).toBe(2)
}, 15000)

test('opens a bed.gz file in the spreadsheet view', async () => {
  const pluginManager = getPluginManager()
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Spreadsheet view'))

  await findByTestId('spreadsheet_view_open')
  fireEvent.click(await findByText('URL'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: { value: 'volvox-bed12.bed.gz' },
  })

  fireEvent.click(await findByTestId('open_spreadsheet'))
  fireEvent.click(await findByText('ctgA:1299..9000'))
  expect(pluginManager.rootModel.session.views.length).toBe(2)
}, 15000)
