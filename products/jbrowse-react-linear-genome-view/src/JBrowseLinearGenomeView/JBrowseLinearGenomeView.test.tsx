import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView'
jest.mock(
  '@jbrowse/react-linear-genome-view/src/makeWorkerInstance',
  () => () => {},
)

const timeout = 20000

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
  const { container, getAllByTestId } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )
  await waitFor(() => expect(getAllByTestId('sequence_track').length).toBe(2), {
    timeout,
  })
  expect(container).toMatchSnapshot()
}, 30000)
