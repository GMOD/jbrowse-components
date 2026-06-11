import { createRef } from 'react'

import { render, waitFor } from '@testing-library/react'

import LinearGenomeView from './LinearGenomeView.tsx'

import type { ViewModel } from '../createModel/createModel.ts'

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

test('<LinearGenomeView /> builds its own engine and navigates via init', async () => {
  const ref = createRef<ViewModel>()
  const { getByPlaceholderText } = render(
    <LinearGenomeView
      ref={ref}
      assembly={assembly}
      tracks={[]}
      init={{ assembly: 'volvox', loc: 'ctgA:1-40' }}
    />,
  )
  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..40')
  }, { timeout })

  // the ref exposed the live engine, and init cleared itself once applied
  expect(ref.current).toBeDefined()
  await waitFor(() => {
    expect(ref.current!.session.view.init).toBeUndefined()
  }, { timeout })
}, 40000)
