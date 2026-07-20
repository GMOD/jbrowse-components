import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import VariantSampleGrid from './VariantSampleGrid.tsx'

import type { VCFFeatureSerialized } from '../types.ts'

function setup(feature: VCFFeatureSerialized) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantSampleGrid feature={feature} />
    </ThemeProvider>,
  )
}

const baseFeature = {
  uniqueId: 'x',
  refName: 'ctgA',
  start: 0,
  end: 1,
  REF: 'A',
  ALT: ['T'],
}

// First sample carries only GT, second adds DP: exercises the column-union path.
const heterogeneousFeature = {
  ...baseFeature,
  samples: {
    HG001: { GT: ['0/1'] },
    HG002: { GT: ['1/1'], DP: [30] },
  },
}

beforeEach(() => {
  localStorage.clear()
  // Isolate the sample grid so its column headers are unambiguous (the
  // frequency tables also render GT/genotype columns).
  localStorage.setItem('variantSampleGrid-showFrequencyTable', 'false')
  localStorage.setItem('variantSampleGrid-showAlleleFrequencies', 'false')
})

// VCF lets a sample omit trailing FORMAT fields, so the first sample can carry
// fewer fields than later ones; columns must be the union, not just row[0]'s.
test('shows a column populated only by a later sample', () => {
  setup(heterogeneousFeature)
  expect(screen.getByRole('columnheader', { name: 'DP' })).toBeInTheDocument()
})

test('the sample count label reflects the number of samples', () => {
  setup(heterogeneousFeature)
  expect(screen.getByText(/Samples\s*\(2\)/)).toBeInTheDocument()
})

test('"GT only" hides FORMAT and resolved-genotype columns', () => {
  setup(heterogeneousFeature)
  fireEvent.click(screen.getByRole('button', { name: 'GT only' }))
  expect(screen.getByRole('columnheader', { name: 'GT' })).toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'DP' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'genotype' }),
  ).not.toBeInTheDocument()
})

test('"GT+resolved genotype" keeps genotype but drops other FORMAT columns', () => {
  setup(heterogeneousFeature)
  fireEvent.click(screen.getByRole('button', { name: 'GT+resolved genotype' }))
  expect(
    screen.getByRole('columnheader', { name: 'genotype' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'DP' }),
  ).not.toBeInTheDocument()
})
