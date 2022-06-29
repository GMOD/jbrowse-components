import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseCircularGenomeView from './JBrowseCircularGenomeView'

window.requestIdleCallback = (
  cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
) => {
  cb({ didTimeout: false, timeRemaining: () => 0 })
  return 0
}
window.cancelIdleCallback = () => {}
window.requestAnimationFrame = cb => setTimeout(cb)
window.cancelAnimationFrame = () => {}

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

describe('<JBrowseCircularGenomeView />', () => {
  it('renders successfully', async () => {
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
    expect(container.firstChild).toMatchSnapshot()
  }, 10000)
})
