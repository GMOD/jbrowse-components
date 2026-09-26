import '@testing-library/jest-dom'

import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// the two chord tracks this file opens - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks([
  'volvox_sv_test',
  'volvox_sv_test_renamed',
])

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('open a circular view', async () => {
  const { findByTestId, findByText, queryByTestId } = await createView({
    ...config,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Launch', ...opts))
  fireEvent.click(await findByTestId('circular_track_select'))
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await waitFor(() => {
    expect(
      Number(
        queryByTestId('structuralVariantChordRenderer')?.dataset.chordCount,
      ),
    ).toBeGreaterThan(0)
  }, delay)
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  fireEvent.click(await findByTestId(hts('volvox_sv_test_renamed'), {}, delay))

  // make sure a chord is rendered
  await waitFor(() => {
    expect(
      Number(
        queryByTestId('structuralVariantChordRenderer')?.dataset.chordCount,
      ),
    ).toBeGreaterThan(0)
  }, delay)
}, 25000)
