import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView'
jest.mock(
  '@jbrowse/react-linear-genome-view/src/makeWorkerInstance',
  () => () => {},
)

const timeout = 30000

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      features: [
        {
          end: 120,
          refName: 'ctgA',
          seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctg',
          start: 0,
          uniqueId: 'firstId',
        },
      ],
      type: 'FromConfigSequenceAdapter',
    },
    trackId: 'volvox_refseq',
    type: 'ReferenceSequenceTrack',
  },
}

const defaultSession = {
  name: 'Test',
  view: {
    bpPerPx: 0.05,
    displayedRegions: [
      {
        assemblyName: 'volvox',
        end: 120,
        refName: 'ctgA',
        reversed: false,
        start: 0,
      },
    ],
    id: 'test_view',
    tracks: [
      {
        configuration: 'volvox_refseq',
        displays: [
          {
            configuration: 'volvox_refseq-LinearReferenceSequenceDisplay',
            type: 'LinearReferenceSequenceDisplay',
          },
        ],
        type: 'ReferenceSequenceTrack',
      },
    ],
    type: 'LinearGenomeView',
  },
}

test('<JBrowseLinearGenomeView /> renders successfully', async () => {
  const state = createViewState({
    assembly,
    defaultSession,
    tracks: [],
  })
  const { container, getAllByTestId, getByPlaceholderText } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )

  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(() => expect(getAllByTestId('sequence_track').length).toBe(2), {
    timeout,
  })
  await waitFor(() => expect(getInputValue()).toBe('ctgA:1..40'), { timeout })

  expect(container).toMatchSnapshot()
}, 40000)
