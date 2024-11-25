import '@testing-library/jest-dom'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts } from './util'
jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 30000 }

beforeEach(() => {
  doBeforeEach()
})

test('change color on track', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findByText, findByDisplayValue } =
    await createView(undefined, true)

  view.setNewView(0.05, 5000)

  await user.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  await user.click(
    await findByTestId(
      'htsTrackEntryMenu-Tracks,volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  await user.click(await findByText('Settings'))
  const elt = await findByDisplayValue('goldenrod', {}, delay)
  await user.clear(elt)
  await user.type(elt, 'green')

  await waitFor(() => {
    expect(getByTestId('box-test-vcf-604453')).toHaveAttribute('fill', 'green')
  }, delay)
}, 40000)
