// library
import React from 'react'
import { cleanup, waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { setup, generateReadBuffer, getPluginManager } from './util'
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
test('test trix from lgv header', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
  const input = await findByPlaceholderText('Search for location')

  // wait for displayedRegions[0] to be volvox, required for searching header
  // of lgv
  await waitFor(() =>
    // @ts-ignore
    expect(state.session.views[0].displayedRegions[0].assemblyName).toEqual(
      'volvox',
    ),
  )

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })

  await waitFor(() =>
    expect((input as HTMLInputElement).value).toBe('ctgA:1,055..9,005'),
  )
}, 30000)

test('test trix from importform', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  // @ts-ignore
  pluginManager.rootModel.session.views[0].clearView()

  const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
  const input = await findByPlaceholderText('Search for location')

  // wait for displayedRegions[0] to be volvox, required for searching header
  // of lgv
  await waitFor(() =>
    // @ts-ignore
    expect(state.session.views[0].displayedRegions[0].assemblyName).toEqual(
      'volvox',
    ),
  )

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })

  await waitFor(() =>
    expect((input as HTMLInputElement).value).toBe('ctgA:1,055..9,005'),
  )
}, 30000)
