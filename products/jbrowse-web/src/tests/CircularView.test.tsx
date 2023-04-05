import '@testing-library/jest-dom/extend-expect'
import { fireEvent, waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/volvox/config.json'
import { doBeforeEach, createView, setup } from './util'

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
  // wait for the UI to be loaded
  await findByText('Help')
  // try opening a track before opening the actual view
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))

  // open a track selector for the circular view
  fireEvent.click(await findByTestId('circular_track_select'))

  // wait for the track selector to open and then click the
  // checkbox for the chord test track to toggle it on
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test', {}, delay))

  // expect the chord track to render eventually
  await findByTestId('structuralVariantChordRenderer', {}, delay)

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-66511')

  // toggle track off
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_sv_test', {}, delay))

  // expect the track to disappear
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  // open up VCF with renamed refNames
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_sv_test_renamed', {}, delay),
  )

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-63101', {}, delay)
}, 25000)
