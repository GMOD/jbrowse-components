import { fireEvent, waitFor } from '@testing-library/react'

import { doBeforeEach, doSetupForImportForm, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('search eden.1 and hit open', async () => {
  const { findByPlaceholderText, findByText, getInputValue } =
    await doSetupForImportForm()

  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('dialog with multiple results, searching seg02', async () => {
  const { autocomplete, findByPlaceholderText, findByText } =
    await doSetupForImportForm()

  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30000)

test('search eden.1 and hit enter', async () => {
  const { autocomplete, findByPlaceholderText, findByText, getInputValue } =
    await doSetupForImportForm()

  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('lower case refname, searching: contigb', async () => {
  const { autocomplete, findByPlaceholderText, findByText, getInputValue } =
    await doSetupForImportForm()

  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement
  fireEvent.change(input, { target: { value: 'contigb' } })
  fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
  fireEvent.keyDown(autocomplete, { key: 'Enter' })

  fireEvent.click(await findByText('Open'))

  await waitFor(() => {
    expect(getInputValue()).toBe('ctgB:1..6,079')
  }, delay)
}, 30000)

test('description of gene, searching: kinase', async () => {
  const { findByPlaceholderText, findByText, getInputValue, autocomplete } =
    await doSetupForImportForm()
  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement
  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('search matches description for feature in two places', async () => {
  const { autocomplete, findByPlaceholderText, findByText } =
    await doSetupForImportForm()

  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(await findByText(/b101.2/, ...opts))
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30000)
