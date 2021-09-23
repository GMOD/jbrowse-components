// library
import React from 'react'
import { cleanup, waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { setup, generateReadBuffer, getPluginManager } from './util'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'
import JBrowse from '../JBrowse'

setup()
afterEach(cleanup)

beforeEach(() => {
  clearAdapterCache()

  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer((url: string) => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})
describe('Integration test for different text search adapters', () => {
  it('test Jb1 adapter', async () => {
    const pluginManager = getPluginManager(jb1_config)
    const { findByTestId, findByPlaceholderText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
    const input = await findByPlaceholderText('Search for location')

    auto.focus()
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'apple3' } })
    fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })

    waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('ctgA:17,402..22,956')
    })
  }, 30000)
})
