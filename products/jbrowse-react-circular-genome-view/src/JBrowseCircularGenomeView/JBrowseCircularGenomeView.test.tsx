import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseCircularGenomeView from './JBrowseCircularGenomeView'

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
        {
          end: 65,
          refName: 'ctgB',
          seq: 'ACATGCTAGCTACGTGCATGCTCGACATGCATCATCAGCCTGATGCTGATACATGCTAGCTACGT',
          start: 0,
          uniqueId: 'secondId',
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
    displayedRegions: [
      {
        assemblyName: 'volvox',
        end: 120,
        refName: 'ctgA',
        start: 0,
      },
      {
        assemblyName: 'volvox',
        end: 65,
        refName: 'ctgB',
        start: 0,
      },
    ],
    id: 'test_view',
    tracks: [],
    type: 'CircularView',
  },
}
beforeEach(() => jest.useFakeTimers())

test('<JBrowseCircularGenomeView />', async () => {
  const state = createViewState({
    assembly,
    defaultSession,
    tracks: [],
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
