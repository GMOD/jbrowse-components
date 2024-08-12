import '@testing-library/jest-dom'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createView, setup, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 50000 }
const opts = [{}, delay]

async function waitForReady() {
  await waitFor(() => {
    expect(screen.getByTestId('open_spreadsheet')).not.toBeDisabled()
  }, delay)
}

test('opens a vcf.gz file in the spreadsheet view', async () => {
  const user = userEvent.setup()
  const { session } = await createView()

  await user.click(await screen.findByText('File'))
  await user.click(await screen.findByText('Add'))
  await user.click(await screen.findByText('Spreadsheet view'))

  fireEvent.change(await screen.findByTestId('urlInput', ...opts), {
    target: { value: 'volvox.filtered.vcf.gz' },
  })

  await waitForReady()
  await user.click(await screen.findByTestId('open_spreadsheet'))
  expect(session.views.length).toBe(2)
}, 50000)

test('opens a bed.gz file in the spreadsheet view', async () => {
  const user = userEvent.setup()
  const { session } = await createView()
  await user.click(await screen.findByText('File'))
  await user.click(await screen.findByText('Add'))
  await user.click(await screen.findByText('Spreadsheet view'))

  fireEvent.change(await screen.findByTestId('urlInput', ...opts), {
    target: { value: 'volvox-bed12.bed.gz' },
  })
  await waitForReady()
  await user.click(await screen.findByTestId('open_spreadsheet'))
  expect(session.views.length).toBe(2)
}, 50000)
