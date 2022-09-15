import '@testing-library/jest-dom/extend-expect'
import { fireEvent, waitFor } from '@testing-library/react'
import { TextEncoder, TextDecoder } from 'web-encoding'

import { doBeforeEach, createView, setup } from './util'

window.TextEncoder = TextEncoder
window.TextDecoder = TextDecoder

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('opens a vcf.gz file in the sv inspector view', async () => {
  console.warn = jest.fn()
  const { session, findByTestId, getByTestId, findByText } = createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('SV inspector'))

  fireEvent.change(await findByTestId('urlInput', {}, delay), {
    target: { value: 'volvox.dup.renamed.vcf.gz' },
  })
  await waitFor(() =>
    expect(
      getByTestId('open_spreadsheet').closest('button'),
    ).not.toBeDisabled(),
  )
  fireEvent.click(await findByTestId('open_spreadsheet'))
  fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

  // confirm breakpoint split view opened
  expect(session.views.length).toBe(3)
  expect(session.views[2].displayName).toBe('bnd_A split detail')
}, 30000)
