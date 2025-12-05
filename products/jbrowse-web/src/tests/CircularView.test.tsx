import '@testing-library/jest-dom'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, hts, setupTest } from './util'
import configSnapshot from '../../test_data/volvox/config.json'

setupTest()

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('open a circular view', async () => {
  const user = userEvent.setup()
  const { findByTestId, findByText, queryByTestId } = await createView({
    ...configSnapshot,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  await user.click(await findByText('File', ...opts))
  await user.click(await findByText(/Open track/, ...opts))
  await user.click(await findByText('Open', ...opts))
  await user.click(await findByTestId('circular_track_select'))
  await user.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await findByTestId('structuralVariantChordRenderer', {}, delay)
  await findByTestId('chord-test-vcf-66511')
  await user.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  await user.click(await findByTestId(hts('volvox_sv_test_renamed'), {}, delay))

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-63101', {}, delay)
}, 25000)
