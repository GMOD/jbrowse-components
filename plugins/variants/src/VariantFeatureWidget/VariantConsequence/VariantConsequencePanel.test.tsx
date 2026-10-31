import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import VariantConsequencePanel from './VariantConsequencePanel.tsx'
import {
  consequenceFormats,
  headerFields,
  parseConsequences,
} from './parseConsequences.ts'

const ANN = consequenceFormats.ANN
const annFields = [
  'Allele',
  'Annotation',
  'Annotation_Impact',
  'Gene_Name',
  'Feature_ID',
  'HGVS.c',
  'Distance',
]

function renderPanel(props: { data: string[]; fields: string[] }) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantConsequencePanel {...props} format={ANN} />
    </ThemeProvider>,
  )
}

test('headerFields trims the padded SnpEff field list', () => {
  expect(
    headerFields(
      "Functional annotations: 'Allele | Annotation | Annotation_Impact'",
      ANN,
    ),
  ).toEqual(['Allele', 'Annotation', 'Annotation_Impact'])
})

test('a column empty in every annotation is dropped', () => {
  const { fields, records } = parseConsequences(
    ['T|intron_variant|MODIFIER|G1|TX1||', 'T|stop_gained|HIGH|G1|TX2|c.1A>T|'],
    annFields,
    ANN,
  )
  expect(fields).not.toContain('Distance')
  expect(fields).toContain('HGVS.c')
  expect(Object.keys(records[1]!.record)).not.toContain('HGVS.c')
})

test('annotations are ordered by impact, keeping file order within one', () => {
  const { records } = parseConsequences(
    [
      'T|intron_variant|MODIFIER|G1|TX1',
      'T|synonymous_variant|LOW|G1|TX2',
      'T|stop_gained|HIGH|G1|TX3',
      'T|upstream_gene_variant|MODIFIER|G2|TX4',
    ],
    annFields,
    ANN,
  )
  expect(records.map(r => r.record.Feature_ID)).toEqual([
    'TX3',
    'TX2',
    'TX1',
    'TX4',
  ])
  expect(records[0]!.headline).toBe('stop_gained · HIGH · G1 · TX3')
})

test('the headline names the allele only when annotations differ in it', () => {
  const { records } = parseConsequences(
    ['T|stop_gained|HIGH|G1|TX1', 'C|missense_variant|MODERATE|G1|TX1'],
    annFields,
    ANN,
  )
  expect(records.map(r => r.headline)).toEqual([
    'T · stop_gained · HIGH · G1 · TX1',
    'C · missense_variant · MODERATE · G1 · TX1',
  ])
})

test('renders one collapsible record per annotation with its fields', () => {
  const { getByText } = renderPanel({
    fields: annFields,
    data: [
      'T|stop_gained|HIGH|G1|TX1|c.1A>T|',
      'T|intron_variant|MODIFIER|G1|TX2||',
    ],
  })
  expect(getByText('Variant ANN field')).toBeTruthy()
  fireEvent.click(getByText('stop_gained · HIGH · G1 · TX1'))
  expect(getByText('c.1A>T')).toBeTruthy()
})

// Regression: a variant that carries ANN data but whose header column names
// never reached the widget used to render a headerless empty "No columns"
// grid. With no resolvable columns the card is suppressed entirely.
test('renders nothing when data is present but column names are missing', () => {
  const { container, queryByText } = renderPanel({
    fields: [],
    data: ['T|stop_gained|HIGH'],
  })
  expect(container.firstChild).toBeNull()
  expect(queryByText('Variant ANN field')).toBeNull()
})

test('renders nothing when there is no ANN data', () => {
  const { container } = renderPanel({
    fields: ['Allele', 'Annotation'],
    data: [],
  })
  expect(container.firstChild).toBeNull()
})
