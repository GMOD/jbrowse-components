import React from 'react'
import { waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { setup, generateReadBuffer, getPluginManager, JBrowse } from './util'

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

test('test trix on import form (type and hit enter)', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )
  // @ts-ignore

  // @ts-ignore
  state.session.views[0].clearView()

  const auto = await findByTestId('autocomplete', {}, delay)
  const input = await findByPlaceholderText('Search for location')
  await waitFor(() => {
    // @ts-ignore
    expect(state.assemblyManager.get('volvox').initialized)
  })

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

  // should work to just have enter and no click on open in UI, but this is
  // needed in test currently. may be worth investigating
  fireEvent.click(await findByText('Open'))

  // this will instead open a dialog of options vs a single item at
  // location 'ctgA:1,055..9,005'
  await waitFor(async () => {
    const newInput = await findByPlaceholderText('Search for location')
    expect((newInput as HTMLInputElement).value).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('test trix on import form (type and no hit enter)', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )

  // @ts-ignore
  state.session.views[0].clearView()

  const auto = await findByTestId('autocomplete', {}, delay)
  const input = await findByPlaceholderText('Search for location')
  await waitFor(() => {
    // @ts-ignore
    expect(state.assemblyManager.get('volvox').initialized)
  })

  auto.focus()
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  // fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })

  // should work to just have enter and no click on open in UI, but this is
  // needed in test currently. may be worth investigating
  fireEvent.click(await findByText('Open'))

  // this will instead open a dialog of options vs a single item at
  // location 'ctgA:1,055..9,005'
  await waitFor(async () => {
    const newInput = await findByPlaceholderText('Search for location')
    expect((newInput as HTMLInputElement).value).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)
