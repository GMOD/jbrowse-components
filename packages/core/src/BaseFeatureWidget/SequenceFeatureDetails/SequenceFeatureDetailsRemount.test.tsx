import { act, render, within } from '@testing-library/react'

import SequenceFeatureDetails from './SequenceFeatureDetails.tsx'
import { SequenceFeatureDetailsF } from './model.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'

// an undefined assemblyName short-circuits the sequence fetch, so the panel
// renders its chrome without the session being touched
const session = {} as AbstractSessionModel

const transcript: SimpleFeatureSerialized = {
  uniqueId: 't',
  refName: 'chr1',
  start: 0,
  end: 100,
  type: 'mRNA',
  subfeatures: [
    { refName: 'chr1', start: 0, end: 100, type: 'exon' },
    { refName: 'chr1', start: 10, end: 90, type: 'CDS' },
  ],
}

const region: SimpleFeatureSerialized = {
  uniqueId: 'r',
  refName: 'chr1',
  start: 0,
  end: 100,
  type: 'region',
}

// the drawer widget is reused (setFeatureData, no remount) when the user clicks
// a second feature, so the panel has to reinitialize the state it derived from
// the first one -- a stale 'cds' on a bare region renders the wrong sequence
// type and puts an out-of-range value in the selector
test('the sequence type reinitializes when the feature prop changes', async () => {
  const model = SequenceFeatureDetailsF().create()
  const panel = (feature: SimpleFeatureSerialized) => (
    <SequenceFeatureDetails
      model={model}
      session={session}
      assemblyName={undefined}
      feature={feature}
    />
  )
  const { container, rerender } = render(panel(transcript))
  await act(async () => {})
  expect(within(container).getByRole('combobox').textContent).toBe('CDS')

  rerender(panel(region))
  await act(async () => {})
  expect(within(container).getByRole('combobox').textContent).toBe('Genomic')
})
