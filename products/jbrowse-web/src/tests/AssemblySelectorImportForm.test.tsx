import { waitFor, fireEvent } from '@testing-library/react'

// locals
import { setup, doSetupForImportForm, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('nav to volvox2', async () => {
  const { getInputValue, findByText } = await doSetupForImportForm()
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('volvox2'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA')
  })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..50,001')
  }, delay)
}, 30000)

test('select volvox404', async () => {
  const { findByText } = await doSetupForImportForm()
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('volvox404'))
  await findByText(/HTTP 404/)
}, 30000)

test('select misc', async () => {
  const { getInputValue, findByText } = await doSetupForImportForm()
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('misc'))
  await waitFor(() => {
    expect(getInputValue()).toBe('t1')
  }, delay)
}, 30000)
