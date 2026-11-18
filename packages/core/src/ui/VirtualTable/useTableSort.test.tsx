import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import VirtualTable from './VirtualTable.tsx'
import { useTableSort } from './useTableSort.ts'

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

const sortKeys = { score: (row: Row) => row.score }

function Table() {
  const { sortedRows, sortProps, sortResetKey } = useTableSort(rows, sortKeys)
  return (
    <VirtualTable
      rows={sortedRows}
      columns={[{ id: 'score', header: 'Score', cell: row => `#${row.id}` }]}
      widths={() => ({})}
      {...sortProps}
      resetKey={sortResetKey}
      emptyMessage="none"
    />
  )
}

function shownIds() {
  return screen.getAllByText(/^#\d$/).map(cell => cell.textContent)
}

test('a header click sorts ascending, then descending, then unsorted, with number-like text by value and blanks last', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Table />
    </ThemeProvider>,
  )
  const header = screen.getByRole('button', { name: 'Score' })
  expect(shownIds()).toEqual(['#1', '#2', '#3', '#4'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#3', '#1', '#4', '#2'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#4', '#1', '#3', '#2'])
  fireEvent.click(header)
  expect(shownIds()).toEqual(['#1', '#2', '#3', '#4'])
})
