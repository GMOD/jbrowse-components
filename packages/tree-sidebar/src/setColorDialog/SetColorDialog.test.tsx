import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

import type { TreeLayoutModel } from './SetColorDialog.tsx'

interface Src {
  name: string
  color?: string
}

function fakeModel(overrides: Partial<TreeLayoutModel<Src>> = {}) {
  return {
    editableSources: [{ name: 'a', color: '#f00' }, { name: 'b' }] as Src[],
    setLayout: jest.fn(),
    clearLayout: jest.fn(),
    willClearTree: jest.fn(() => false),
    ...overrides,
  }
}

function setup(model: TreeLayoutModel<Src>) {
  const handleClose = jest.fn()
  render(<SetColorDialog model={model} handleClose={handleClose} />)
  return { handleClose }
}

test('Submit persists the layout and closes when no tree would be cleared', () => {
  const model = fakeModel()
  const { handleClose } = setup(model)

  fireEvent.click(screen.getByText('Submit'))

  expect(model.setLayout).toHaveBeenCalledWith(model.editableSources)
  expect(handleClose).toHaveBeenCalled()
  expect(screen.queryByText(/Clear cluster tree/)).toBeNull()
})

test('Submit warns first when it would invalidate a loaded cluster tree', () => {
  const model = fakeModel({ willClearTree: jest.fn(() => true) })
  const { handleClose } = setup(model)

  fireEvent.click(screen.getByText('Submit'))

  // warning shown, nothing committed yet
  expect(screen.getByText(/Clear cluster tree/)).toBeInTheDocument()
  expect(model.setLayout).not.toHaveBeenCalled()
  expect(handleClose).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Continue'))
  expect(model.setLayout).toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})

// Regression: the warning must consult the model live, not a snapshot taken at
// render. Clearing custom settings drops the tree, so a subsequent Submit must
// not pop the (now-spurious) warning.
test('no spurious warning after Clear custom settings drops the tree', () => {
  const willClearTree = jest.fn(() => true)
  const clearLayout = jest.fn(() => {
    willClearTree.mockReturnValue(false)
  })
  const model = fakeModel({ willClearTree, clearLayout })
  setup(model)

  fireEvent.click(screen.getByText('Clear custom settings'))
  expect(clearLayout).toHaveBeenCalled()

  fireEvent.click(screen.getByText('Submit'))
  expect(screen.queryByText(/Clear cluster tree/)).toBeNull()
  expect(model.setLayout).toHaveBeenCalled()
})
