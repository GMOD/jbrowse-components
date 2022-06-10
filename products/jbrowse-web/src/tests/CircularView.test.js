import React from 'react'
import '@testing-library/jest-dom/extend-expect'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import configSnapshot from '../../test_data/volvox/config.json'
import { JBrowse, setup, getPluginManager, generateReadBuffer } from './util'

setup()

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

test('open a circular view', async () => {
  console.warn = jest.fn()
  const pluginManager = getPluginManager({
    ...configSnapshot,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
    configuration: {
      rpc: {
        defaultDriver: 'MainThreadRpcDriver',
      },
    },
  })
  const { findByTestId, findByText, queryByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  // wait for the UI to be loaded
  await findByText('Help')
  // try opening a track before opening the actual view
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText(/Open track/))
  fireEvent.click(await findByText('Open'))

  // open a track selector for the circular view
  fireEvent.click(await findByTestId('circular_track_select'))

  // wait for the track selector to open and then click the
  // checkbox for the chord test track to toggle it on
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test'))

  // expect the chord track to render eventually
  await findByTestId('structuralVariantChordRenderer', {}, { timeout: 10000 })

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-66132')

  // toggle track off
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test'))

  // expect the track to disappear
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  // open up VCF with renamed refNames
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test_renamed'))

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-62852', {}, { timeout: 10000 })
}, 25000)
