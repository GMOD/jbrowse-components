import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import VariantSampleFilters from './VariantSampleFilters.tsx'

const columns = [{ field: 'genotype' }, { field: 'alleles' }]
const filter = { genotype: '0|0', alleles: 'A' }

function setup(overrides = {}) {
  const setFilter = jest.fn()
  render(
    <VariantSampleFilters
      columns={columns}
      filter={filter}
      setFilter={setFilter}
      {...overrides}
    />,
  )
  return { setFilter }
}

test('renders an input per column with initial values', () => {
  setup()
  expect(screen.getByPlaceholderText('Filter genotype')).toHaveValue('0|0')
  expect(screen.getByPlaceholderText('Filter alleles')).toHaveValue('A')
})

test('empty filter shows empty inputs', () => {
  setup({ filter: {} })
  expect(screen.getByPlaceholderText('Filter genotype')).toHaveValue('')
  expect(screen.getByPlaceholderText('Filter alleles')).toHaveValue('')
})

test('calls setFilter with updated field, preserving others', () => {
  const { setFilter } = setup()
  fireEvent.change(screen.getByPlaceholderText('Filter genotype'), {
    target: { value: '1|1' },
  })
  expect(setFilter).toHaveBeenCalledWith({ genotype: '1|1', alleles: 'A' })
})

test('clearing a field passes empty string', () => {
  const { setFilter } = setup()
  fireEvent.change(screen.getByPlaceholderText('Filter alleles'), {
    target: { value: '' },
  })
  expect(setFilter).toHaveBeenCalledWith({ genotype: '0|0', alleles: '' })
})
