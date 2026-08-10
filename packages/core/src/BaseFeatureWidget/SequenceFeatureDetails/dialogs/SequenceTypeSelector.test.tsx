import { fireEvent, render, within } from '@testing-library/react'

import { getDefaultMode } from '../featureTypeUtil.ts'
import { SequenceFeatureDetailsF } from '../model.ts'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'

function openedOptions(feature: SimpleFeatureSerialized) {
  const { container } = render(
    <SequenceTypeSelector
      model={SequenceFeatureDetailsF().create()}
      feature={feature}
      // same source the panel initializes mode from, so the selected value is
      // always one of the options this feature offers
      mode={getDefaultMode(feature)}
      setMode={() => {}}
    />,
  )
  fireEvent.mouseDown(within(container).getByRole('combobox'))
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      '[data-testid^="sequence_type_"]',
    ),
  ].map(el => el.dataset.testid!.replace('sequence_type_', ''))
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

test('a bare region offers the genomic types', () => {
  expect(openedOptions(region)).toEqual([
    'genomic',
    'genomic_sequence_updownstream',
  ])
})

// the gene_* types already span the whole feature, with and without flanks, so
// a spliced feature has no use for the plain genomic ones -- what they render
// differently (CDS/UTR coloring, casing) is the upperCaseCDS setting's job
test('a coding transcript offers the spliced types instead', () => {
  expect(openedOptions(transcript)).toEqual([
    'cds',
    'protein',
    'cdna',
    'gene',
    'gene_updownstream',
    'gene_collapsed_intron',
    'gene_updownstream_collapsed_intron',
  ])
})
