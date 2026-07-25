import { fireEvent, render, within } from '@testing-library/react'

import SequenceTypeSelector from './SequenceTypeSelector.tsx'
import { SequenceFeatureDetailsF } from '../model.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'

function openedOptions(feature: SimpleFeatureSerialized) {
  const { container } = render(
    <SequenceTypeSelector
      model={SequenceFeatureDetailsF().create()}
      feature={feature}
      mode="genomic"
      setMode={() => {}}
    />,
  )
  fireEvent.mouseDown(within(container).getByRole('combobox'))
  return [
    ...document.body.querySelectorAll('[data-testid^="sequence_type_"]'),
  ].map(el => el.getAttribute('data-testid')!.replace('sequence_type_', ''))
}

const region = {
  uniqueId: 'r',
  refName: 'chr1',
  start: 0,
  end: 100,
  type: 'region',
}

const transcript = {
  ...region,
  type: 'mRNA',
  subfeatures: [
    { refName: 'chr1', start: 0, end: 100, type: 'exon' },
    { refName: 'chr1', start: 10, end: 90, type: 'CDS' },
  ],
}

test('a bare region offers only the genomic types', () => {
  expect(openedOptions(region)).toEqual([
    'genomic',
    'genomic_sequence_updownstream',
  ])
})

test('a coding transcript also offers the raw genomic span', () => {
  // the gene_* types are the spliced/highlighted views; the plain genomic ones
  // are how a promoter or terminator gets read off a transcript
  expect(openedOptions(transcript)).toEqual([
    'cds',
    'protein',
    'cdna',
    'gene',
    'gene_updownstream',
    'gene_collapsed_intron',
    'gene_updownstream_collapsed_intron',
    'genomic',
    'genomic_sequence_updownstream',
  ])
})
