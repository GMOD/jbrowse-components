import { screen, waitFor, fireEvent } from '@testing-library/react'

// locals
import { setup, createView, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }

async function doSetup(val?: unknown) {
  const args = createView(val)
  const { view, findByTestId, getByPlaceholderText, findByPlaceholderText } =
    args

  // clear view takes us to the import form
  view.clearView()

  const autocomplete = await findByTestId('autocomplete')
  const input = (await findByPlaceholderText(
    'Search for location',
  )) as HTMLInputElement

  // this will be the input that is obtained after opening the LGV from the import form
  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value

  autocomplete.focus()
  input.focus()

  return {
    autocomplete,
    input,
    getInputValue,
    ...args,
  }
}

test('search eden.1 and hit open', async () => {
  console.warn = jest.fn()
  const { input, getInputValue, findByText } = await doSetup()
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => expect(getInputValue()).toBe('ctgA:1,055..9,005'), delay)
}, 30000)

test('search eden.1 and hit enter', async () => {
  console.warn = jest.fn()
  const { input, findByText, autocomplete, getInputValue } = await doSetup()

  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'eden.1' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  fireEvent.click(await findByText('Open'))
  await waitFor(() => expect(getInputValue()).toBe('ctgA:1,055..9,005'), delay)
}, 30000)

test('lower case refname, searching: contigb', async () => {
  console.warn = jest.fn()
  const { input, autocomplete, findByText, getInputValue } = await doSetup()

  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'contigb' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await findByText('Open'))

  await waitFor(() => expect(getInputValue()).toBe('ctgB:1..6,079'), delay)
}, 30000)

test('description of gene, searching: kinase', async () => {
  console.warn = jest.fn()
  const { input, findByText, getInputValue, autocomplete } = await doSetup()

  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'kinase' } })
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  fireEvent.click(await screen.findByText('EDEN (protein kinase)', {}, delay))
  fireEvent.click(await findByText('Open'))
  await waitFor(() => expect(getInputValue()).toBe('ctgA:1,055..9,005'), delay)
}, 30000)
