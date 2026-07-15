import { Suspense, createRef } from 'react'

import { render } from '@testing-library/react'

import CircularGenomeView from './CircularGenomeView.tsx'

import type { ViewModel } from '../createModel/createModel.ts'

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

beforeEach(() => jest.useFakeTimers())

test('<CircularGenomeView /> builds its own engine and shows regions via init', async () => {
  const ref = createRef<ViewModel>()
  // init omits the assembly name on purpose: it is filled in from the
  // `assembly` prop (volvox) by the component. `{}` just opens that assembly
  const { findAllByText } = render(
    <Suspense fallback={<div>Loading...</div>}>
      <CircularGenomeView ref={ref} assembly={assembly} tracks={[]} init={{}} />
    </Suspense>,
  )
  ref.current!.session.view.setWidth(800)
  await findAllByText('ctgA', {}, { timeout: 10000 })

  // init drove the displayed regions, then cleared itself
  jest.runAllTimers()
  expect(ref.current!.session.view.init).toBeUndefined()
}, 10000)
