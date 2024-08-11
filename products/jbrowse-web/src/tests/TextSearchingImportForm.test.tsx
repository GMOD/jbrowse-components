import { waitFor, fireEvent } from '@testing-library/react'

// locals
import { setup, doSetupForImportForm, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('search eden.1 and hit open', async () => {
  const { input, getInputValue, findByText } = await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('dialog with multiple results, searching seg02', async () => {
  const { input, findByText, autocomplete } = await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'seg02' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30000)

test('search eden.1 and hit enter', async () => {
  const { input, findByText, autocomplete, getInputValue } =
    await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('lower case refname, searching: contigb', async () => {
  const { input, autocomplete, findByText, getInputValue } =
    await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'contigb' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))

  await waitFor(() => {
    expect(getInputValue()).toBe('ctgB:1..6,079')
  }, delay)
}, 30000)

test('description of gene, searching: kinase', async () => {
  const { input, findByText, getInputValue, autocomplete } =
    await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1,055..9,005')
  }, delay)
}, 30000)

test('search matches description for feature in two places', async () => {
  const { input, findByText, autocomplete } = await doSetupForImportForm()

  fireEvent.change(input, { target: { value: 'fingerprint' } })
  fireEvent.click(await findByText(/b101.2/, ...opts))
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))
  await findByText('Search results', ...opts)
}, 30000)
