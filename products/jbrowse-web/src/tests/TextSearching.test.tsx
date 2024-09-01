import { waitFor, fireEvent } from '@testing-library/react'

// locals
import { setup, doBeforeEach, createView } from './util'
import jb1_config from '../../test_data/volvox/volvox_jb1_text_config.json'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

async function doSetup(val?: unknown) {
  const args = await createView(val)
  const { findByTestId, findByPlaceholderText } = args

  const autocomplete = await findByTestId('autocomplete', ...opts)
  const input = (await findByPlaceholderText(
    'Search for location',
  )) as HTMLInputElement

  autocomplete.focus()
  input.focus()

  return { autocomplete, input, ...args }
}

test('single result, searching: eden.1', async () => {
  const { input, autocomplete } = await doSetup()
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(input.value).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('dialog with multiple results, searching seg02', async () => {
  const { input, findByText, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await findByText('Search results', ...opts)
}, 30000)

test('dialog with multiple results with jb1 config, searching: eden.1', async () => {
  const { input, findByText, autocomplete } = await doSetup(jb1_config)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await findByText('Search results', ...opts)
}, 30000)

test('test navigation with the search input box, {volvox2}ctgB:1..200', async () => {
  const { view, input, autocomplete } = await doSetup()
  fireEvent.change(input, { target: { value: '{volvox2}ctgB:1..200' } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.assemblyName).toEqual('volvox2')
  })
}, 30000)

test('nav lower case refnames, searching: ctgb:1-100', async () => {
  const { view, input, autocomplete } = await doSetup()
  fireEvent.change(input, { target: { value: 'ctgb:1-100' } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 30000)

test('nav lower case refnames, searching: ctgb', async () => {
  const { view, input, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'ctgb' } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 30000)

test('nav lower case refnames, searching: contigb:1-100', async () => {
  const { view, input, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'contigb:1-100' } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(view.displayedRegions[0]!.refName).toBe('ctgB')
  })
}, 30000)

test('description of gene, searching: kinase', async () => {
  const { input, findByText, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await waitFor(() => {
    expect(input.value).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('search matches description for feature in two places', async () => {
  const { input, findByText, autocomplete } = await doSetup()

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(await findByText(/b101.2/, ...opts))
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  await findByText('Search results', ...opts)
}, 30000)
