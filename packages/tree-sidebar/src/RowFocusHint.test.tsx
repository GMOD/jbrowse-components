import { fireEvent, render } from '@testing-library/react'

import { RowFocusHint } from './RowFocusHint.tsx'

import type { TreeSidebarModel } from './types.ts'

function model(
  hint?: { text: string; title: string },
  clears = true,
): TreeSidebarModel {
  return {
    rowNarrowingHint: hint,
    rowNarrowingClears: clears,
    rowFocusLineHeight: 16,
    sources: [],
    showAllRows: jest.fn(),
    setRowFocus: jest.fn(),
    setScrollTop: jest.fn(),
    treeAreaWidth: 80,
    height: 100,
    rowsTopOffset: 0,
    showTree: true,
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
  }
}

test('says how many rows show, and shows every row again on a click', () => {
  const m = model({ text: 'Showing 3 of 10 rows · Show all', title: '' })
  const { getByText } = render(<RowFocusHint model={m} />)
  fireEvent.click(getByText('Showing 3 of 10 rows · Show all'))
  expect(m.showAllRows).toHaveBeenCalledWith()
  // the rows re-lay-out from y=0, so the old offset would strand them
  expect(m.setScrollTop).toHaveBeenCalledWith(0)
})

// The config's own filter is a fact, not something a click clears: the chip
// states it, and a click neither clears nor dismisses it, so it never leaves
// its line empty above the rows.
test('a narrowing nothing can clear stays, and a click does nothing', () => {
  const m = model(
    {
      text: 'Showing 3 of 10 rows',
      title: "The track's config keeps rows where population is EUR",
    },
    false,
  )
  const { getByText, queryByTestId } = render(<RowFocusHint model={m} />)
  expect(getByText('Showing 3 of 10 rows').title).toBe(
    "The track's config keeps rows where population is EUR",
  )
  fireEvent.click(getByText('Showing 3 of 10 rows'))
  expect(m.showAllRows).not.toHaveBeenCalled()
  expect(queryByTestId('row_focus_hint')).not.toBeNull()
})

test('draws nothing while every row is shown', () => {
  const { container } = render(<RowFocusHint model={model()} />)
  expect(container.firstChild).toBeNull()
})
