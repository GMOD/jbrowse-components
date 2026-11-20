import { useState } from 'react'

import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { highlightPatterns } from '../../util/searchText.ts'
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
  shown = rows,
  scrollToRowId,
  onSort,
  sortField = '',
  sortAscending = true,
  onRowClick,
  rowHeight,
}: {
  shown?: typeof rows
  scrollToRowId?: number
  onSort?: (field: string, ascending: boolean) => void
  sortField?: string
  sortAscending?: boolean
  onRowClick?: (row: { id: number; name: string }) => void
  rowHeight?: number
}) {
  return (
    <ThemeProvider theme={theme}>
      <VirtualTable
        rows={shown}
        columns={[
          {
            id: 'name',
            header: 'Name',
            sortValue: row => row.name,
            cell: row => row.name,
          },
        ]}
        widths={() => ({ name: 100 })}
        sortField={sortField}
        sortAscending={sortAscending}
        onSort={onSort}
        onRowClick={onRowClick}
        rowHeight={rowHeight}
        scrollToRowId={scrollToRowId}
        emptyMessage="none"
        testId="table"
      />
    </ThemeProvider>
  )
}

test('a row far down scrolls to the middle of the rows on view', () => {
  const { getByTestId } = render(table({ scrollToRowId: 250 }))
  const room = viewport - HEADER_HEIGHT
  expect(getByTestId('table').scrollTop).toBe(
    250 * ROW_HEIGHT - (room - ROW_HEIGHT) / 2,
  )
})

test('a short row height draws each row at that height and scrolls by it', () => {
  const rowHeight = 18
  const { getByTestId, getByText } = render(
    table({ scrollToRowId: 250, rowHeight }),
  )
  const room = viewport - HEADER_HEIGHT
  expect(getByTestId('table').scrollTop).toBe(
    250 * rowHeight - (room - rowHeight) / 2,
  )
  const { style } = getByText('r0').closest('tr')!
  expect(style.height).toBe(`${rowHeight}px`)
  expect(style.lineHeight).toBe(`${rowHeight - 1}px`)
})

test('a row already on view does not scroll', () => {
  const { getByTestId } = render(table({ scrollToRowId: 2 }))
  expect(getByTestId('table').scrollTop).toBe(0)
})

function Stepped({ steps }: { steps: Parameters<typeof table>[0][] }) {
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

test('a row the filters leave out does not scroll', () => {
  const { getByTestId, getByText } = render(
    <Stepped
      steps={[
        { scrollToRowId: 250 },
        { shown: rows.filter(row => row.id !== 10), scrollToRowId: 10 },
      ]}
    />,
  )
  const { scrollTop } = getByTestId('table')
  expect(scrollTop).toBeGreaterThan(0)
  fireEvent.click(getByText('next'))
  expect(getByTestId('table').scrollTop).toBe(scrollTop)
})

test('a row a sort moves does not pull the list after it', () => {
  const reversed = rows.toReversed()
  const { getByTestId, getByText } = render(
    <Stepped
      steps={[
        { scrollToRowId: 2 },
        { shown: reversed, scrollToRowId: 2 },
        { shown: reversed, scrollToRowId: 3 },
      ]}
    />,
  )
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

test('without an onSort, a sortable column header is a plain label', () => {
  const { queryByRole, getByText } = render(table({}))
  expect(queryByRole('button', { name: 'Name' })).toBeNull()
  expect(getByText('Name')).toBeTruthy()
})

test('a row click hands back its row', () => {
  const onRowClick = jest.fn()
  const { getByText } = render(table({ onRowClick }))
  fireEvent.click(getByText('r3'))
  expect(onRowClick).toHaveBeenCalledWith(rows[3])
})

test('a clickable row takes focus and answers Enter', () => {
  const onRowClick = jest.fn()
  const { getByText } = render(table({ onRowClick }))
  const row = rowOf(getByText('r3'))
  expect(row.tabIndex).toBe(0)
  fireEvent.keyDown(row, { key: 'Enter' })
  expect(onRowClick).toHaveBeenCalledWith(rows[3])
})

test('a row with no click handler is not focusable', () => {
  const { getByText } = render(table({}))
  expect(rowOf(getByText('r3')).hasAttribute('tabindex')).toBe(false)
})

function rowOf(cell: HTMLElement) {
  const row = cell.closest('tr')
  if (!row) {
    throw new Error('cell is not in a row')
  }
  return row
}

describe('search highlight', () => {
  class FakeHighlight extends Set<AbstractRange> {}
  const highlights = new Map<string, FakeHighlight>()

  beforeAll(() => {
    Object.defineProperties(globalThis, {
      CSS: { value: { highlights }, configurable: true },
      Highlight: { value: FakeHighlight, configurable: true },
    })
  })

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'CSS')
    Reflect.deleteProperty(globalThis, 'Highlight')
  })

  function highlightStyles() {
    return [...document.head.querySelectorAll('style')].filter(el =>
      el.textContent.includes('::highlight('),
    )
  }

  function markedTags() {
    return [...highlights.values()].flatMap(highlight =>
      [...highlight].map(range => range.startContainer.parentElement?.tagName),
    )
  }

  function searched(names: string[]) {
    return (
      <ThemeProvider theme={theme}>
        <VirtualTable
          rows={names.map((name, id) => ({ id, name }))}
          columns={[{ id: 'name', header: 'Name', cell: row => row.name }]}
          widths={() => ({ name: 100 })}
          emptyMessage="No matching name"
          highlightPatterns={highlightPatterns('name')}
        />
      </ThemeProvider>
    )
  }

  test('marks the rows, not the header or the empty message', () => {
    const { rerender } = render(searched(['first name', 'surname']))
    expect(markedTags()).toEqual(['TD', 'TD'])
    rerender(searched([]))
    expect(markedTags()).toEqual([])
  })

  test('its style element goes when the table unmounts', () => {
    const { unmount } = render(searched(['first name']))
    expect(highlightStyles()).toHaveLength(1)
    unmount()
    expect(highlightStyles()).toHaveLength(0)
  })
})

test('dragging a fill column gives it its width, the table stops stretching, and a double-click hands the room back', () => {
  const { container } = render(
    <ThemeProvider theme={theme}>
      <VirtualTable
        rows={rows}
        columns={[
          { id: 'name', header: 'Name', fill: true, cell: row => row.name },
          { id: 'id', header: 'Id', cell: row => row.id },
        ]}
        widths={() => ({ name: 300, id: 100 })}
        emptyMessage="none"
      />
    </ThemeProvider>,
  )
  const tableEl = container.querySelector('table')!
  const nameCol = container.querySelector('col')!
  expect(nameCol.style.width).toBe('')
  expect(tableEl.style.width).toBe('')
  expect(tableEl.style.minWidth).toBe('400px')

  // jsdom implements no pointer capture
  const handle = container.querySelector<HTMLElement>('[data-resize-handle]')!
  handle.setPointerCapture = () => {}
  fireEvent.pointerDown(handle, { clientX: 300, pointerId: 1, button: 0 })
  fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientX: 150, pointerId: 1 })

  expect(nameCol.style.width).toBe('150px')
  expect(tableEl.style.width).toBe('250px')

  fireEvent.doubleClick(handle)
  expect(nameCol.style.width).toBe('')
  expect(tableEl.style.width).toBe('')
  expect(tableEl.style.minWidth).toBe('400px')
})
