import { waitFor, fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

// locals
import { setup, generateReadBuffer, createView } from './util'

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()

  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      (url: string) =>
        new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 10000 }

const total = 30000

async function doSetup(val?: unknown) {
  const {
    view,
    findByText,
    findByTestId,
    findAllByText,
    findByPlaceholderText,
    getByPlaceholderText,
  } = createView(val)

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
    await waitFor(() => {
      const n = getByPlaceholderText('Search for location') as HTMLInputElement
      expect(n.value).toBe('ctgA:1,055..9,005')
    }, delay)
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
    await waitFor(() => {
      const n = getByPlaceholderText('Search for location') as HTMLInputElement
      expect(n.value).toBe('ctgA:1,055..9,005')
    }, delay)
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
    await waitFor(() => {
      const n = getByPlaceholderText('Search for location') as HTMLInputElement
      expect(n.value).toBe('ctgB:1..6,079')
    }, delay)
  },
  total,
)
