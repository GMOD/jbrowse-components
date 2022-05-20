import React from 'react'
import '@testing-library/jest-dom/extend-expect'

import { fireEvent, render, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { JBrowse, getPluginManager, generateReadBuffer } from './util'
jest.mock('../makeWorkerInstance', () => () => {})

const waitForOptions = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

test('change color on track', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel
  const { getByTestId, findByTestId, findByText, findByDisplayValue } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor')
  fireEvent.change(await findByDisplayValue('goldenrod'), {
    target: { value: 'green' },
  })
  await waitFor(
    () =>
      expect(getByTestId('box-test-vcf-604452')).toHaveAttribute(
        'fill',
        'green',
      ),
    waitForOptions,
  )
}, 20000)
