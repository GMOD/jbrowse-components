import { fireEvent, waitFor } from '@testing-library/react'

import { doBeforeEach, doSetupForImportForm, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30_000 }
const opts = [{}, delay]

async function getInput() {
  const rest = await doSetupForImportForm()
  return {
    ...rest,
    input: (await rest.findByPlaceholderText(
      'Search for location',
      ...opts,
    )) as HTMLInputElement,
  }
}

test('search eden.1 and hit open', async () => {
  const { input, findByText, getInputValue } = await getInput()

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..10,590')
  }, delay)
}, 30_000)

test('dialog with multiple results, searching seg02', async () => {
  const { autocomplete, input, findByText } = await getInput()

  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30_000)

test('search eden.1 and hit enter', async () => {
  const { getInputValue, autocomplete, input, findByText } = await getInput()

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..10,590')
  }, delay)
}, 30_000)

test('lower case refname, searching: contigb', async () => {
  const { getInputValue, autocomplete, input, findByText } = await getInput()

  fireEvent.change(input, { target: { value: 'contigb' } })
  fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
  fireEvent.keyDown(autocomplete, { key: 'Enter' })

  fireEvent.click(await findByText('Open'))

  await waitFor(() => {
    expect(getInputValue()).toBe('ctgB:1..6,079')
  }, delay)
}, 30_000)

test('description of gene, searching: kinase', async () => {
  const { getInputValue, autocomplete, input, findByText } = await getInput()

  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..10,590')
  }, delay)
}, 30_000)

test('search matches description for feature in two places', async () => {
  const { autocomplete, input, findByText } = await getInput()

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(await findByText(/b101.2/, ...opts))
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30_000)
