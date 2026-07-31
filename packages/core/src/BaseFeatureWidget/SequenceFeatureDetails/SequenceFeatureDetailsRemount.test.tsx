import { useState } from 'react'

import { act, fireEvent, render, within } from '@testing-library/react'

import SequenceFeatureDetails from './SequenceFeatureDetails.tsx'
import { SequenceFeatureDetailsF } from './model.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'
import type { SequenceFeatureDetailsModel } from './model.ts'

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

// Swaps the feature from inside a tree that stays mounted, which is what the
// drawer widget does (setFeatureData on the same widget). Note this can't be
// written with RTL's rerender(): that tears the tree down and mounts a fresh
// one, so the panel would reinitialize for free and the test would pass even
// with the reinitialization removed.
function Harness({ model }: { model: SequenceFeatureDetailsModel }) {
  const [feature, setFeature] = useState(transcript)
  return (
    <>
      <button
        onClick={() => {
          setFeature(region)
        }}
      >
        next feature
      </button>
      <SequenceFeatureDetails
        model={model}
        session={session}
        assemblyName={undefined}
        feature={feature}
      />
    </>
  )
}

// a stale 'cds' on a bare region renders the wrong sequence type and puts an
// out-of-range value in the selector, which displays as blank
test('the sequence type reinitializes when the feature prop changes', async () => {
  const { container, getByRole } = render(
    <Harness model={SequenceFeatureDetailsF().create()} />,
  )
  await act(async () => {})
  expect(within(container).getByRole('combobox').textContent).toBe('CDS')

  fireEvent.click(getByRole('button', { name: 'next feature' }))
  await act(async () => {})
  expect(within(container).getByRole('combobox').textContent).toBe('Genomic')
})
