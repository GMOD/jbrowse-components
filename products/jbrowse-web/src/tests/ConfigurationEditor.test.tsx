import '@testing-library/jest-dom/extend-expect'

import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts } from './util'
jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

test('change color on track', async () => {
  const { view, getByTestId, findByTestId, findByText, findByDisplayValue } =
    await createView(undefined, true)

  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor', {}, delay)
  fireEvent.change(await findByDisplayValue('goldenrod'), {
    target: { value: 'green' },
  })
  await waitFor(() => {
    const elt = getByTestId('box-test-vcf-604453')
    expect(elt).toHaveAttribute('fill', 'green')
  }, delay)
}, 20000)
