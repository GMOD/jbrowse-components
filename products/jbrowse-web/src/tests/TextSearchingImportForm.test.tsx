import React from 'react'
import { waitFor, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { setup, generateReadBuffer, getPluginManager, JBrowse } from './util'

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

const total = 30000

async function doSetup(val?: unknown) {
  const pluginManager = getPluginManager(val)
  const state = pluginManager.rootModel
  const {
    findByText,
    findByTestId,
    findAllByText,
    findByPlaceholderText,
    getByPlaceholderText,
  } = render(<JBrowse pluginManager={pluginManager} />)

  // @ts-ignore
  const view = state.session.views[0] as LGV
  view.clearView()

  const autocomplete = await findByTestId('autocomplete')
  const input = (await findByPlaceholderText(
    'Search for location',
  )) as HTMLInputElement

  autocomplete.focus()
  input.focus()

  return {
    view,
    autocomplete,
    input,
    findByText,
    findAllByText,
    findByPlaceholderText,
    getByPlaceholderText,
    state,
  }
}

test(
  'test trix on import form (type and hit enter)',
  async () => {
    console.warn = jest.fn()
    const { input, findByText, getByPlaceholderText } = await doSetup()
    fireEvent.change(input, { target: { value: 'eden.1' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    fireEvent.click(await findByText('Open'))

    await waitFor(
      () =>
        expect(
          (getByPlaceholderText('Search for location') as HTMLInputElement)
            .value,
        ).toBe('ctgA:1,055..9,005'),
      delay,
    )
  },
  total,
)

test(
  'test trix on import form (type and no hit enter)',
  async () => {
    console.warn = jest.fn()
    const { input, findByText, autocomplete, getByPlaceholderText } =
      await doSetup()

    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'eden.1' } })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    fireEvent.click(await findByText('Open'))
    await waitFor(
      () =>
        expect(
          (getByPlaceholderText('Search for location') as HTMLInputElement)
            .value,
        ).toBe('ctgA:1,055..9,005'),
      delay,
    )
  },
  total,
)

test(
  'lower case refname',
  async () => {
    console.warn = jest.fn()
    const { input, findByText, autocomplete, getByPlaceholderText } =
      await doSetup()

    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'contigb' } })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    fireEvent.click(await findByText('Open'))
    await waitFor(
      () =>
        expect(
          (getByPlaceholderText('Search for location') as HTMLInputElement)
            .value,
        ).toBe('ctgB:1..6,079'),
      delay,
    )
  },
  total,
)
