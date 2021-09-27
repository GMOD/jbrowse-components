// library
import React from 'react'
import {
  screen,
  cleanup,
  waitFor,
  fireEvent,
  render,
} from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'

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

  await waitFor(
    () => expect((input as HTMLInputElement).value).toBe('ctgA:1,055..9,005'),
    { timeout: 10000 },
  )
}, 30000)

test('test trix on import form', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  // @ts-ignore
  pluginManager.rootModel.session.views[0].clearView()

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

  // should work to just have enter and no click on open in UI, but this is
  // needed in test currently. may be worth investigating
  fireEvent.click(await findByText('Open'))

  await waitFor(
    async () => {
      const newInput = await findByPlaceholderText('Search for location')
      expect((newInput as HTMLInputElement).value).toBe('ctgA:1,055..9,005')
    },
    { timeout: 10000 },
  )
}, 30000)

test('opens a dialog with multiple results', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
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
  await screen.findByText('Search Results')
  // @ts-ignore
  expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
}, 30000)

test('opens a dialog with multiple results with jb1 text search adapter results', async () => {
  const pluginManager = getPluginManager(jb1_config)
  const state = pluginManager.rootModel
  const { findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pluginManager} />,
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
  await screen.findByText('Search Results')
  // @ts-ignore
  expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
}, 30000)
