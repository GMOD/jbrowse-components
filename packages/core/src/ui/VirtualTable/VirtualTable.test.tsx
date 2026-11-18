import { useState } from 'react'

import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import VirtualTable from './VirtualTable.tsx'
import { HEADER_HEIGHT, ROW_HEIGHT } from './tableStyles.ts'

const viewport = 200

beforeAll(() => {
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(viewport)
})

const theme = createJBrowseTheme()

const rows = Array.from({ length: 300 }, (_, i) => ({ id: i, name: `r${i}` }))

function table({
  scrollToIndex,
  scrollToKey = scrollToIndex,
  onSort = () => {},
  sortField = '',
  sortAscending = true,
  onRowClick,
}: {
  scrollToIndex?: number
  scrollToKey?: string | number
  onSort?: (field: string, ascending: boolean) => void
  sortField?: string
  sortAscending?: boolean
  onRowClick?: (row: { id: number; name: string }) => void
}) {
  return (
    <ThemeProvider theme={theme}>
      <VirtualTable
        rows={rows}
        columns={[{ id: 'name', header: 'Name', cell: row => row.name }]}
        widths={() => ({ name: 100 })}
        sortField={sortField}
        sortAscending={sortAscending}
        onSort={onSort}
        onRowClick={onRowClick}
        resetKey=""
        scrollToKey={scrollToKey}
        scrollToIndex={scrollToIndex}
        emptyMessage="none"
        testId="table"
      />
    </ThemeProvider>
  )
}

test('a row far down scrolls to the middle of the rows on view', () => {
  const { getByTestId } = render(table({ scrollToIndex: 250 }))
  const room = viewport - HEADER_HEIGHT
  expect(getByTestId('table').scrollTop).toBe(
    250 * ROW_HEIGHT - (room - ROW_HEIGHT) / 2,
  )
})

test('a row already on view does not scroll', () => {
  const { getByTestId } = render(table({ scrollToIndex: 2 }))
  expect(getByTestId('table').scrollTop).toBe(0)
})

test('a row a sort moves does not pull the list after it', () => {
  const steps = [
    { scrollToKey: 'a', scrollToIndex: 2 },
    { scrollToKey: 'a', scrollToIndex: 250 },
    { scrollToKey: 'b', scrollToIndex: 250 },
  ]
  function Harness() {
    const [step, setStep] = useState(0)
    return (
      <>
        <button
          onClick={() => {
            setStep(step + 1)
          }}
        >
          next
        </button>
        {table(steps[step]!)}
      </>
    )
  }
  const { getByTestId, getByText } = render(<Harness />)
  fireEvent.click(getByText('next'))
  expect(getByTestId('table').scrollTop).toBe(0)
  fireEvent.click(getByText('next'))
  expect(getByTestId('table').scrollTop).toBeGreaterThan(0)
})

test('a header click cycles ascending, descending, unsorted', () => {
  const onSort = jest.fn()
  const { getByRole, rerender } = render(table({ onSort }))
  fireEvent.click(getByRole('button', { name: 'Name' }))
  expect(onSort).toHaveBeenLastCalledWith('name', true)
  rerender(table({ onSort, sortField: 'name' }))
  fireEvent.click(getByRole('button', { name: 'Name' }))
  expect(onSort).toHaveBeenLastCalledWith('name', false)
  rerender(table({ onSort, sortField: 'name', sortAscending: false }))
  fireEvent.click(getByRole('button', { name: 'Name' }))
  expect(onSort).toHaveBeenLastCalledWith('', true)
})

test('a row click hands back its row', () => {
  const onRowClick = jest.fn()
  const { getByText } = render(table({ onRowClick }))
  fireEvent.click(getByText('r3'))
  expect(onRowClick).toHaveBeenCalledWith(rows[3])
})
