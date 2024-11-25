import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'

import { doBeforeEach, createView, setup, hts } from './util'
import configSnapshot from '../../test_data/volvox/config.json'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('open a circular view', async () => {
  const { findByTestId, findByText, queryByTestId } = await createView({
    ...configSnapshot,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))
  fireEvent.click(await findByTestId('circular_track_select'))
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await findByTestId('structuralVariantChordRenderer', {}, delay)
  await findByTestId('chord-test-vcf-66511')
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  fireEvent.click(await findByTestId(hts('volvox_sv_test_renamed'), {}, delay))

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-63101', {}, delay)
}, 25000)
