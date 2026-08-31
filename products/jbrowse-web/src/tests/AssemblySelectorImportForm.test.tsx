import { fireEvent, waitFor } from '@testing-library/react'

import {
  doBeforeEach,
  doSetupForImportForm,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// nothing here reaches a track: the form is about assemblies - see
// volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_filtered_vcf'])

const delay = { timeout: 20000 }

test('nav to volvox2', async () => {
  const { getInputValue, findByText } = await doSetupForImportForm(config)
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
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { findByText } = await doSetupForImportForm(config)
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('volvox404'))
  await findByText(/HTTP 404/)
  jest.restoreAllMocks()
}, 30000)

// The typed location belongs to the assembly it was typed for, so switching
// assemblies has to drop it — otherwise Open carries a volvox locstring into
// misc. Nothing clears it by hand: the state is tagged with its assembly and
// read back only on a match, so this is the tag doing its job.
test('typing a location then switching assembly drops what was typed', async () => {
  const { input, getInputValue, findByText } =
    await doSetupForImportForm(config)
  fireEvent.change(input, { target: { value: 'ctgA:100-200' } })
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:100-200')
  })
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('misc'))
  await waitFor(() => {
    expect(getInputValue()).toBe('t1')
  }, delay)
}, 30000)

test('select misc', async () => {
  const { getInputValue, findByText } = await doSetupForImportForm(config)
  fireEvent.mouseDown(await findByText('volvox'))
  fireEvent.click(await findByText('misc'))
  await waitFor(() => {
    expect(getInputValue()).toBe('t1')
  }, delay)
}, 30000)
