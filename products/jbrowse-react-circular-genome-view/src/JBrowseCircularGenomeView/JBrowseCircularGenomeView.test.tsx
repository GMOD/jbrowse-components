import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseCircularGenomeView from './JBrowseCircularGenomeView'

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
        {
          refName: 'ctgB',
          uniqueId: 'secondId',
          start: 0,
          end: 65,
          seq: 'ACATGCTAGCTACGTGCATGCTCGACATGCATCATCAGCCTGATGCTGATACATGCTAGCTACGT',
        },
      ],
    },
  },
}

const defaultSession = {
  name: 'Test',
  view: {
    id: 'test_view',
    type: 'CircularView',
    displayedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 120,
        assemblyName: 'volvox',
      },
      {
        refName: 'ctgB',
        start: 0,
        end: 65,
        assemblyName: 'volvox',
      },
    ],
    tracks: [],
  },
}
beforeEach(() => jest.useFakeTimers())

test('<JBrowseCircularGenomeView />', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    defaultSession,
  })
  state.session.view.setWidth(800)
  const { container, findAllByText } = render(
    <Suspense fallback={<div>Loading...</div>}>
      <JBrowseCircularGenomeView viewState={state} />
    </Suspense>,
  )
  await findAllByText('ctgA', {}, { timeout: 10000 })

  // xref https://stackoverflow.com/a/64875069/2129219 without this ripples non-deterministically show up in snapshot
  jest.runAllTimers()
  expect(container).toMatchSnapshot()
}, 10000)
