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

test('the search narrows the samples and counts what it kept', () => {
  setup(heterogeneousFeature)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: 'hg002' },
  })
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2')
  expect(screen.getByText('HG002')).toBeInTheDocument()
  expect(screen.queryByText('HG001')).not.toBeInTheDocument()
})

describe('the genotype table', () => {
  const cohort = {
    ...baseFeature,
    samples: {
      S1: { GT: ['0/1'] },
      S2: { GT: ['1/1'] },
      S3: { GT: ['0/1'] },
    },
  }

  beforeEach(() => {
    localStorage.setItem('variantSampleGrid-showFrequencyTable', 'true')
  })

  function checkbox(name: string) {
    return screen.getByRole('checkbox', { name })
  }

  function genotypeRow(gt: string) {
    return screen.getAllByRole('row').find(r => r.textContent.startsWith(gt))!
  }

  test('starts with every genotype checked and no filter', () => {
    setup(cohort)
    expect(checkbox('Select all genotypes')).toBeChecked()
    expect(checkbox('Select 0/1')).toBeChecked()
    expect(screen.getByText(/Samples\s*\(3\)/)).toBeInTheDocument()
  })

  test('unchecking a genotype filters it out, and checking it again is no filter', () => {
    setup(cohort)
    fireEvent.click(checkbox('Select 1/1'))
    expect(screen.getByText(/Samples\s*\(2 of 3\)/)).toBeInTheDocument()
    expect(checkbox('Select all genotypes')).toHaveAttribute(
      'data-indeterminate',
      'true',
    )
    fireEvent.click(checkbox('Select 1/1'))
    expect(screen.getByText(/Samples\s*\(3\)/)).toBeInTheDocument()
  })

  test('re-checking every genotype is no filter, so a genotype that appears later shows', () => {
    localStorage.setItem('variantSampleGrid-showFilters', 'true')
    setup({ ...cohort, samples: { ...cohort.samples, S4: { GT: ['0/0'] } } })
    const sampleFilter = screen.getByRole('textbox', { name: 'Filter sample' })
    fireEvent.change(sampleFilter, { target: { value: 'S[123]' } })
    fireEvent.click(checkbox('Select 1/1'))
    fireEvent.click(checkbox('Select 1/1'))
    fireEvent.change(sampleFilter, { target: { value: '' } })
    expect(screen.getByText(/Samples\s*\(4\)/)).toBeInTheDocument()
  })

  test('select-all clears every genotype, then restores no filter', () => {
    setup(cohort)
    fireEvent.click(checkbox('Select all genotypes'))
    expect(screen.getByText(/Samples\s*\(0 of 3\)/)).toBeInTheDocument()
    fireEvent.click(checkbox('Select all genotypes'))
    expect(screen.getByText(/Samples\s*\(3\)/)).toBeInTheDocument()
  })

  test('clicking a row shows only its genotype, and clicking it again shows all', () => {
    setup(cohort)
    fireEvent.click(genotypeRow('1/1'))
    expect(screen.getByText(/Samples\s*\(1 of 3\)/)).toBeInTheDocument()
    fireEvent.click(genotypeRow('1/1'))
    expect(screen.getByText(/Samples\s*\(3\)/)).toBeInTheDocument()
  })
})
