// library
import React from 'react'
import { cleanup, waitFor, fireEvent, render } from '@testing-library/react'
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

    const autocomplete = await findByTestId('autocomplete')
    const inputBox = await findByPlaceholderText('Search for location')

    autocomplete.focus()
    fireEvent.mouseDown(inputBox)
    fireEvent.change(inputBox, {
      target: { value: 'apple3' },
    })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    waitFor(() => {
      expect((inputBox as HTMLInputElement).value).toBe('ctgA:17,402..22,956')
    })
  }, 30000)
})
