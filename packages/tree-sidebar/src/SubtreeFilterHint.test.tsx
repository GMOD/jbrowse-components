import { fireEvent, render } from '@testing-library/react'

import { SubtreeFilterHint } from './SubtreeFilterHint.tsx'

import type { TreeSidebarModel } from './types.ts'

function model(subtreeFilter?: string[]) {
  return {
    subtreeFilter,
    setSubtreeFilter: jest.fn(),
    setScrollTop: jest.fn(),
    treeAreaWidth: 80,
    height: 100,
    showTree: true,
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
  } as unknown as TreeSidebarModel
}

test('says how many rows the focus left, and clears it on a click', () => {
  const m = model(['a', 'b', 'c'])
  const { getByText } = render(<SubtreeFilterHint model={m} />)
  fireEvent.click(getByText('Showing 3 rows'))
  expect(m.setSubtreeFilter).toHaveBeenCalledWith(undefined)
  // the rows re-lay-out from y=0, so the old offset would strand them
  expect(m.setScrollTop).toHaveBeenCalledWith(0)
})

test('draws nothing while every row is shown', () => {
  const { container } = render(<SubtreeFilterHint model={model()} />)
  expect(container.firstChild).toBeNull()
})
