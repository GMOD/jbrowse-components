import React from 'react'
import { screen, waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { setup, generateReadBuffer, getPluginManager, JBrowse } from './util'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'

setup()

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
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )

  // @ts-ignore
  const view = state.session.views[0]

  const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
  const input = await findByPlaceholderText('Search for location')

  // wait for displayedRegions[0] to be volvox, required for searching header
  // of lgv
  await waitFor(() =>
    // @ts-ignore
    expect(view.displayedRegions[0].assemblyName).toEqual('volvox'),
  )

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })
  await waitFor(
    () => expect((input as HTMLInputElement).value).toBe('ctgA:1,055..9,005'),
    { timeout: 10000 },
  )
}, 30000)

test('opens a dialog with multiple results', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )

  const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
  const input = await findByPlaceholderText('Search for location')
  await waitFor(() => {
    // @ts-ignore
    expect(state.assemblyManager.get('volvox').initialized)
  })

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })
  await screen.findByText('Search results', {}, { timeout: 10000 })
  // @ts-ignore
  expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
}, 30000)

test('opens a dialog with multiple results with jb1 text search adapter results', async () => {
  const pm = getPluginManager(jb1_config)
  const state = pm.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )

  const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
  const input = await findByPlaceholderText('Search for location')
  await waitFor(() => {
    // @ts-ignore
    expect(state.assemblyManager.get('volvox').initialized)
  })

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })
  await screen.findByText('Search results', {}, { timeout: 10000 })
  // @ts-ignore
  expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
}, 30000)

test('test navigation with the search input box', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  // @ts-ignore
  const view = state.session.views[0]
  fireEvent.click(await findByText('Help'))

  const autocomplete = await findByTestId('autocomplete')
  const inputBox = await findByPlaceholderText('Search for location')

  autocomplete.focus()
  inputBox.focus()
  fireEvent.mouseDown(inputBox)
  fireEvent.change(inputBox, {
    target: { value: '{volvox2}ctgB:1..200' },
  })
  fireEvent.keyDown(inputBox, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() =>
    // @ts-ignore
    expect(view.displayedRegions[0].assemblyName).toEqual('volvox2'),
  )
})
