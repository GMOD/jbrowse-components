import '@testing-library/jest-dom'

import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

import type { TreeLayoutModel } from './SetColorDialog.tsx'
import type { ColorColumn } from './SourceGrid.tsx'

interface Src {
  name: string
  color?: string
  labelColor?: string
  group?: string
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

const TWO_COLOR_COLUMNS: ColorColumn<Src>[] = [
  { field: 'color', headerName: 'Track color' },
  { field: 'labelColor', headerName: 'Label color' },
]

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

test('the header toggle switches which color column the grid edits', () => {
  render(
    <SetColorDialog
      model={fakeModel()}
      handleClose={jest.fn()}
      colorColumns={TWO_COLOR_COLUMNS}
      defaultColorField="labelColor"
    />,
  )

  // defaultColorField makes label color the active (visible) swatch column
  expect(
    screen.getByRole('columnheader', { name: 'Label color' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'Track color' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Track color' }))

  expect(
    screen.getByRole('columnheader', { name: 'Track color' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'Label color' }),
  ).not.toBeInTheDocument()
})

// Regression: "Color by" used to hardcode `color`, so in multi-wiggle density
// mode — where the grid edits `labelColor` because `color` drives the score
// ramp — palettizing silently painted a field the user wasn't looking at.
test('Color by paints the active color column, not always `color`', () => {
  const setLayout = jest.fn()
  render(
    <SetColorDialog
      model={fakeModel({
        setLayout,
        editableSources: [
          { name: 'a', group: 'g1' },
          { name: 'b', group: 'g2' },
        ],
      })}
      handleClose={jest.fn()}
      colorColumns={TWO_COLOR_COLUMNS}
      defaultColorField="labelColor"
      enableRowPalettizer
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: /Color by/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'group' }))
  fireEvent.click(screen.getByText('Submit'))

  const submitted = setLayout.mock.calls[0]![0] as Src[]
  expect(submitted.every(s => !!s.labelColor)).toBe(true)
  expect(submitted.every(s => s.color === undefined)).toBe(true)
  // distinct groups get distinct palette entries
  expect(submitted[0]!.labelColor).not.toBe(submitted[1]!.labelColor)
})

test('Clear names the active color column and unsets only that field', () => {
  const setLayout = jest.fn()
  render(
    <SetColorDialog
      model={fakeModel({
        setLayout,
        editableSources: [{ name: 'a', color: '#f00', labelColor: '#0f0' }],
      })}
      handleClose={jest.fn()}
      colorColumns={TWO_COLOR_COLUMNS}
      defaultColorField="labelColor"
      enableRowPalettizer
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: /Color by/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear label colors' }))
  fireEvent.click(screen.getByText('Submit'))

  const submitted = setLayout.mock.calls[0]![0] as Src[]
  expect(submitted[0]!.labelColor).toBeUndefined()
  expect(submitted[0]!.color).toBe('#f00')
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
