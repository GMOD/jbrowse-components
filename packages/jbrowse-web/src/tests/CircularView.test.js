// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import configSnapshot from '../../test_data/volvox/config.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, readBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})

describe('circular views', () => {
  it('open a circular view', async () => {
    console.warn = jest.fn()
    const configSnapshotWithCircular = JSON.parse(
      JSON.stringify(configSnapshot),
    )
    configSnapshotWithCircular.savedSessions[0] = {
      name: 'Integration Test Circular',
      views: [
        {
          id: 'integration_test_circular',
          type: 'CircularView',
        },
      ],
    }
    const pluginManager = getPluginManager(configSnapshotWithCircular)
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    // wait for the UI to be loaded
    await findByText('Help')

    fireEvent.click(await findByText('Open'))

    // open a track selector for the circular view
    const trackSelectButtons = await findAllByTestId('circular_track_select')
    expect(trackSelectButtons.length).toBe(1)
    fireEvent.click(trackSelectButtons[0])

    // wait for the track selector to open and then click the
    // checkbox for the chord test track to toggle it on
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_chord_test'))

    // expect the chord track to render eventually
    await expect(
      findByTestId('rpc-rendered-circular-chord-track'),
    ).resolves.toBeTruthy()
  })
})
