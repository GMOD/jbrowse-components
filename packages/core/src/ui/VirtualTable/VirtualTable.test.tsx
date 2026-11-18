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
  scrollToIndex,
  scrollToKey = scrollToIndex,
  onSort = () => {},
  sortField = '',
  sortAscending = true,
  onRowClick,
  rowHeight,
}: {
  scrollToIndex?: number
  scrollToKey?: string | number
  onSort?: (field: string, ascending: boolean) => void
  sortField?: string
  sortAscending?: boolean
  onRowClick?: (row: { id: number; name: string }) => void
  rowHeight?: number
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
        rowHeight={rowHeight}
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

test('a short row height draws each row at that height and scrolls by it', () => {
  const rowHeight = 18
  const { getByTestId, getByText } = render(
    table({ scrollToIndex: 250, rowHeight }),
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

describe('search highlight', () => {
  class FakeHighlight extends Set<AbstractRange> {}
  const highlights = new Map<string, FakeHighlight>()

  beforeAll(() => {
    Object.defineProperty(globalThis, 'CSS', {
      value: { highlights },
      configurable: true,
    })
    Object.defineProperty(globalThis, 'Highlight', {
      value: FakeHighlight,
      configurable: true,
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
          sortField=""
          sortAscending
          onSort={() => {}}
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
