import { useState } from 'react'

import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import VirtualTable from './VirtualTable.tsx'
import { useTableSort } from './useTableSort.ts'

import type { VirtualTableColumn } from './VirtualTable.tsx'

beforeAll(() => {
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
})

interface Row {
  id: number
  score: string
}

const rows: Row[] = [
  { id: 1, score: '10' },
  { id: 2, score: '' },
  { id: 3, score: '9' },
  { id: 4, score: '100' },
]

const idColumn: VirtualTableColumn<Row> = {
  id: 'id',
  header: 'Id',
  cell: row => `#${row.id}`,
}

const scoreColumn: VirtualTableColumn<Row> = {
  id: 'score',
  header: 'Score',
  sortValue: row => row.score,
  cell: row => row.score,
}

function Table() {
  const [showScore, setShowScore] = useState(true)
  const columns = showScore ? [idColumn, scoreColumn] : [idColumn]
  const { sortedRows, sortProps } = useTableSort(rows, columns)
  return (
    <>
      <button
        onClick={() => {
          setShowScore(!showScore)
        }}
      >
        toggle score
      </button>
      <VirtualTable
        rows={sortedRows}
        columns={columns}
        widths={() => ({})}
        {...sortProps}
        emptyMessage="none"
      />
    </>
  )
}

function renderTable() {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Table />
    </ThemeProvider>,
  )
}

function shownIds() {
  return screen.getAllByText(/^#\d$/).map(cell => cell.textContent)
}

test('a header click sorts ascending, then descending, then unsorted, with number-like text by value and blanks last', () => {
  renderTable()
  const header = screen.getByRole('button', { name: 'Score' })
  expect(shownIds()).toEqual(['#1', '#2', '#3', '#4'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#3', '#1', '#4', '#2'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#4', '#1', '#3', '#2'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#1', '#2', '#3', '#4'])
})

test('a column without a sort value is a plain header, not a button', () => {
  renderTable()
  expect(screen.queryByRole('button', { name: 'Id' })).toBeNull()
  expect(screen.getByRole('columnheader', { name: 'Id' })).toBeTruthy()
})

test('hiding the sorted column leaves the rows unsorted and no arrow', () => {
  renderTable()
  fireEvent.click(screen.getByRole('button', { name: 'Score' }))
  expect(shownIds()).toEqual(['#3', '#1', '#4', '#2'])
  fireEvent.click(screen.getByText('toggle score'))
  expect(shownIds()).toEqual(['#1', '#2', '#3', '#4'])
  expect(
    screen
      .getAllByRole('columnheader')
      .filter(th => th.getAttribute('aria-sort')),
  ).toEqual([])
})
