import { render, waitFor } from '@testing-library/react'

import { createViewState } from '../index.ts'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView.tsx'
jest.mock('../makeWorkerInstance', () => () => {})

const timeout = 30000

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 120,
          seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctg',
        },
      ],
    },
  },
}

const defaultSession = {
  name: 'Test',
  view: {
    id: 'test_view',
    type: 'LinearGenomeView',
    bpPerPx: 0.05,
    displayedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 120,
        reversed: false,
        assemblyName: 'volvox',
      },
    ],
    tracks: [
      {
        type: 'ReferenceSequenceTrack',
        configuration: 'volvox_refseq',
        displays: [
          {
            type: 'LinearReferenceSequenceDisplay',
            configuration: 'volvox_refseq-LinearReferenceSequenceDisplay',
          },
        ],
      },
    ],
  },
}

test('<JBrowseLinearGenomeView /> renders successfully', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    defaultSession,
  })
  const { getAllByTestId, getByPlaceholderText } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )

  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(
    () => {
      expect(getAllByTestId('sequence-display').length).toBe(1)
    },
    {
      timeout,
    },
  )
  await waitFor(
    () => {
      expect(getInputValue()).toBe('ctgA:1..40')
    },
    { timeout },
  )
}, 40000)

test('top-level location + highlight navigate via init', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    location: 'ctgA:1-40',
    highlight: ['ctgA:5-10'],
  })
  const { getByPlaceholderText } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )
  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(
    () => {
      expect(getInputValue()).toBe('ctgA:1..40')
    },
    { timeout },
  )
  // init consumes highlight and backfills assemblyName, then clears itself
  await waitFor(
    () => {
      expect(state.session.view.init).toBeUndefined()
    },
    { timeout },
  )
  expect(state.session.view.highlight).toEqual([
    expect.objectContaining({
      refName: 'ctgA',
      start: 4,
      end: 10,
      assemblyName: 'volvox',
    }),
  ])
}, 40000)
