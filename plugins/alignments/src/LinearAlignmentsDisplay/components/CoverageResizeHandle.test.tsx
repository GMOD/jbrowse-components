import { cleanup, render, screen } from '@testing-library/react'

import { CoverageResizeHandle } from './PileupComponent.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

afterEach(cleanup)

const TITLE = 'Drag to resize the coverage track of every group'

function renderHandles(coverageHeight: number) {
  const model = {
    height: 400,
    isGrouped: true,
    scrollModel: { isGrouped: true, scrollTop: 0, canvasHeight: 400 },
    bandHeights: { coverageHeight },
    setCoverageHeight: jest.fn(),
    renderSections: [0, 1].map(i => ({
      groupKey: `g${i}`,
      coverageTop: i * 150,
      coverageHeight,
    })),
  } as unknown as LinearAlignmentsDisplayModel
  render(<CoverageResizeHandle model={model} />)
}

test('every group whose coverage band reserves px gets a handle', () => {
  renderHandles(40)
  expect(screen.getAllByTitle(TITLE)).toHaveLength(2)
})

// a band bound to 0 px has nothing to resize, and its handle would sit at the
// group's top, over the arc or sashimi handle below it
test('a coverage band reserving no px gets no handle', () => {
  renderHandles(0)
  expect(screen.queryAllByTitle(TITLE)).toHaveLength(0)
})
