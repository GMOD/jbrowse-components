import { fireEvent, waitFor, within } from '@testing-library/react'

import { createView, doBeforeEach, setup } from './util.tsx'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40_000 }
const opts = [{}, delay]

function typeAndEnter({
  input,
  value,
}: {
  input: HTMLInputElement
  value: string
}) {
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
}

async function doSetup(val?: unknown) {
  const args = await createView(val)
  const { findByTestId, findByPlaceholderText } = args

  const autocomplete = await findByTestId('autocomplete', ...opts)
  const input = (await findByPlaceholderText(
    'Search for location',
    ...opts,
  )) as HTMLInputElement

  autocomplete.focus()
  input.focus()

  return {
    autocomplete,
    input,
    ...args,
  }
}

test('lower case refname, click ctgB', async () => {
  const { input, findByRole } = await doSetup()

  fireEvent.mouseDown(input)
  fireEvent.click(within(await findByRole('listbox')).getByText(/ctgB/))

  await waitFor(() => {
    expect(input.value).toBe('ctgB:1..6,079')
  }, delay)
}, 50_000)

test('single result, searching: eden.1', async () => {
  const { input } = await doSetup()
  typeAndEnter({ input, value: 'eden.1' })
  await waitFor(() => {
    expect(input.value).toBe('ctgA:1..10,590')
  }, delay)
}, 40_000)

test('dialog with multiple results, searching seg02', async () => {
  const { input, findByText } = await doSetup()

  typeAndEnter({ input, value: 'seg02' })
  await findByText('Search results', ...opts)
}, 40_000)

test('dialog with multiple results with jb1 config, searching: eden.1', async () => {
  const { input, findByText } = await doSetup(jb1_config)
  typeAndEnter({ input, value: 'eden.1' })
  await findByText('Search results', ...opts)
}, 40_000)

test('test navigation with the search input box, {volvox2}ctgB:1..200', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: '{volvox2}ctgB:1..200' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.assemblyName).toEqual('volvox2')
  })
}, 40_000)

test('nav lower case refnames, searching: ctgb:1-100', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: 'ctgb:1-100' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 40_000)

test('nav lower case refnames, searching: ctgb', async () => {
  const { view, input } = await doSetup()

  typeAndEnter({ input, value: 'ctgb' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 40_000)

test('nav lower case refnames, searching: contigb:1-100', async () => {
  const { view, input } = await doSetup()
  typeAndEnter({ input, value: 'contigb:1-100' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 40_000)

test('description of gene, searching: kinase', async () => {
  const { input, findByText } = await doSetup()

  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
  await waitFor(() => {
    expect(input.value).toBe('ctgA:1..10,590')
  }, delay)
}, 40_000)

test('search matches description for feature in two places', async () => {
  const { input, findByText } = await doSetup()

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(await findByText(/b101.2/, ...opts))
  await findByText('Search results', ...opts)
}, 40_000)

test('failed search resets input to visible location', async () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()
  const { input, findByText, view } = await doSetup()

  // Wait for coarseVisibleLocStrings to populate (has 100ms delay in autorun)
  // and blur input so useLayoutEffect can update its value
  input.blur()
  await waitFor(() => {
    expect(view.coarseVisibleLocStrings).not.toBe('')
    expect(input.value).not.toBe('')
  }, delay)

  const originalValue = input.value
  input.focus()

  typeAndEnter({ input, value: 'nonexistent_location_xyz123' })

  await findByText(/Unknown feature or sequence/, ...opts)

  await waitFor(() => {
    expect(input.value).toBe(originalValue)
  }, delay)
  consoleMock.mockRestore()
}, 40_000)
