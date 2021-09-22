// library
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { setup, generateReadBuffer, getPluginManager } from './util'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'
import JBrowse from '../JBrowse'

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
describe('Integration test for different text search adapters', () => {
  it('test Jb1 adapter', async () => {
    const pluginManager = getPluginManager(jb1_config)
    const state = pluginManager.rootModel
    const { findByText, findByTestId, findByPlaceholderText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByText('Help'))
    // need this to complete before we can try to search
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const autocomplete = await findByTestId('autocomplete')
    const inputBox = await findByPlaceholderText('Search for location')

    autocomplete.focus()
    fireEvent.mouseDown(inputBox)
    fireEvent.change(inputBox, {
      target: { value: 'apple3' },
    })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
    // test search results dialog opening
    await screen.findByText('Search Results')
    expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
  }, 30000)
})
