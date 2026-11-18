import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import DetailTable from './DetailTable.tsx'

const rows = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
]
const columns = [
  { field: 'name', sortValue: (row: { name: string }) => row.name },
]

test('a table with an export name has a search box and an export button', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DetailTable rows={rows} columns={columns} exportName="names" />
    </ThemeProvider>,
  )
  expect(screen.getByRole('textbox', { name: 'Search' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy()
})

test('a table without an export name has no search or export', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DetailTable rows={rows} columns={columns} />
    </ThemeProvider>,
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  expect(screen.getAllByRole('row')).toHaveLength(3)
})

interface Sample {
  id: number
  name: string
  assay: string
}

const samples: Sample[] = [
  { id: 1, name: 'THP-1 CpG', assay: 'Fiber-seq' },
  { id: 2, name: 'K562 CpG', assay: 'Fiber-seq' },
  { id: 3, name: 'THP-1 RNA', assay: 'RNA-seq' },
]
const sampleColumns = [
  { field: 'name', sortValue: (row: Sample) => row.name },
  { field: 'assay', sortValue: (row: Sample) => row.assay },
]

function searchSamples(query: string) {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DetailTable rows={samples} columns={sampleColumns} exportName="s" />
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: query },
  })
  return {
    names: samples
      .map(sample => sample.name)
      .filter(name => screen.queryByText(name)),
    status: screen.queryByRole('status')?.textContent,
  }
}

test('a quoted phrase must match as typed, and the count says how many', () => {
  expect(searchSamples('"thp-1 cpg"')).toEqual({
    names: ['THP-1 CpG'],
    status: '1 of 3',
  })
})

test('a leading minus leaves out the rows holding the word', () => {
  expect(searchSamples('cpg -k562').names).toEqual(['THP-1 CpG'])
})

test('a word typed without its hyphen still finds the row', () => {
  expect(searchSamples('thp1').names).toEqual(['THP-1 CpG', 'THP-1 RNA'])
})
