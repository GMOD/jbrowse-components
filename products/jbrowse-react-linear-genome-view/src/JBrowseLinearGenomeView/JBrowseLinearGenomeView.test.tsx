import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { createViewState } from '..'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView'

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
          seq:
            'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctg',
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

describe('<JBrowseLinearGenomeView />', () => {
  it('renders successfully', async () => {
    const state = createViewState({
      assembly,
      tracks: [],
      defaultSession,
    })
    state.session.view.setWidth(800)
    const { container, findByText } = render(
      <Suspense fallback={<div>Loading...</div>}>
        <JBrowseLinearGenomeView viewState={state} />
      </Suspense>,
    )
    await findByText(/Reference Sequence/)
    expect(container.firstChild).toMatchSnapshot()
  })
})
