// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render, wait } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import configSnapshot from '../../test_data/volvox/config.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'

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

describe('circular views', () => {
  it('open a circular view', async () => {
    console.warn = jest.fn()
    const configSnapshotWithCircular = JSON.parse(
      JSON.stringify(configSnapshot),
    )
    configSnapshotWithCircular.defaultSession = {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    }
    const pluginManager = getPluginManager(configSnapshotWithCircular)
    const {
      findByTestId,
      findAllByTestId,
      findByText,
      getByTestId,
      queryByTestId,
    } = render(<JBrowse pluginManager={pluginManager} />)
    // wait for the UI to be loaded
    await findByText('Help')

    fireEvent.click(await findByText('Open'))

    // open a track selector for the circular view
    const trackSelectButtons = await findAllByTestId('circular_track_select')
    expect(trackSelectButtons.length).toBe(1)
    fireEvent.click(trackSelectButtons[0])

    // wait for the track selector to open and then click the
    // checkbox for the chord test track to toggle it on
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test'))

    // expect the chord track to render eventually
    await wait(() => {
      expect(getByTestId('structuralVariantChordRenderer')).toBeInTheDocument()
    })
    // make sure a chord is rendered
    await wait(() => {
      expect(getByTestId('chord-test-vcf-66132')).toBeInTheDocument()
    })

    // toggle track off
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test'))

    // expect the track to disappear
    await wait(() => {
      expect(
        queryByTestId('structuralVariantChordRenderer'),
      ).not.toBeInTheDocument()
    })

    // open up VCF with renamed refNames
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test_renamed'))
    // make sure a chord is rendered
    await wait(() => {
      expect(getByTestId('chord-test-vcf-62852')).toBeInTheDocument()
    })
  }, 10000)
})
