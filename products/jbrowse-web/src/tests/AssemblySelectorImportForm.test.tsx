import { screen, waitFor, fireEvent } from '@testing-library/react'

// locals
import { setup, doSetupForImportForm, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }

test('select volvox', async () => {
  const { getInputValue, findByText } = await doSetupForImportForm()
  fireEvent.click(await findByText('volvox', {}, delay))
  fireEvent.click(await findByText('volvox404', {}, delay))
  fireEvent.click(await findByText('Open'))
  await waitFor(() => expect(getInputValue()).toBe('ctgA:1,055..9,005'), delay)
}, 30000)
