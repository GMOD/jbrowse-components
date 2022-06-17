import React from 'react'
import { screen, waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { setup, generateReadBuffer, getPluginManager, JBrowse } from './util'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'

type LGV = LinearGenomeViewModel

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

const delay = { timeout: 10000 }

async function doSetup(val?: unknown) {
  const pluginManager = getPluginManager(val)
  const state = pluginManager.rootModel
  const { findByText, findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  // @ts-ignore
  const view = state.session.views[0] as LGV
  fireEvent.click(await findByText('Help'))

  const autocomplete = await findByTestId('autocomplete')
  const input = await findByPlaceholderText('Search for location')

  await waitFor(() => {
    // @ts-ignore
    expect(state.assemblyManager.get('volvox').initialized)
  })
  autocomplete.focus()
  input.focus()

  return { view, autocomplete, input }
}
test('test trix from lgv header', async () => {
  const { input, autocomplete } = await doSetup()
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(
    () => expect((input as HTMLInputElement).value).toBe('ctgA:1,055..9,005'),
    delay,
  )
}, 30000)

test('opens a dialog with multiple results', async () => {
  const { input, view, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  // await screen.findByText('Search results', {}, delay)
  await waitFor(() => expect(view.searchResults?.length).toBeGreaterThan(0))
}, 30000)

test('opens a dialog with multiple results with jb1 text search adapter results', async () => {
  const { input, view, autocomplete } = await doSetup(jb1_config)

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await screen.findByText('Search results', {}, delay)
  expect(view.searchResults?.length).toBeGreaterThan(0)
}, 30000)

test('test navigation with the search input box', async () => {
  const { input, view, autocomplete } = await doSetup()
  fireEvent.change(input, {
    target: { value: '{volvox2}ctgB:1..200' },
  })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() =>
    expect(view.displayedRegions[0].assemblyName).toEqual('volvox2'),
  )
})

test('nav lower case refnames', async () => {
  const { input, view, autocomplete } = await doSetup()

  fireEvent.change(input, {
    target: { value: 'ctgb:1-100' },
  })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => expect(view.displayedRegions[0].refName).toBe('ctgB'))
  console.log(view.displayedRegions[0])
})
