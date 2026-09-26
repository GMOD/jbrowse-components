import '@testing-library/jest-dom'

import React from 'react'

import { fireEvent, render, screen, within } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

import type { RowColorSetting } from '../TreeSidebarMixin.ts'
import type { TreeLayoutModel } from './SetColorDialog.tsx'
import type { ColorColumn } from './SourceGrid.tsx'

interface Src {
  name: string
  color?: string
  labelColor?: string
  group?: string
}

const PALETTE = ['#111111', '#222222', '#333333']

// A deal of each value of the setting's field, its listed values taking their
// range colour, the rest the palette in first-seen order.
function previewOf(rows: Src[]) {
  return (setting: RowColorSetting) => {
    const colors = new Map<string, string>()
    setting.domain.forEach((value, i) => colors.set(value, setting.range[i]!))
    let next = 0
    for (const row of rows) {
      const value =
        setting.field === 'name'
          ? row.name
          : String((row as unknown as Record<string, unknown>)[setting.field])
      if (!colors.has(value)) {
        colors.set(value, PALETTE[next++ % PALETTE.length]!)
      }
    }
    return colors
  }
}

function fakeModel(overrides: Partial<TreeLayoutModel<Src>> = {}) {
  const editableSources = overrides.editableSources ?? [
    { name: 'a', color: '#f00' },
    { name: 'b' },
  ]
  const rowColorSetting: RowColorSetting = overrides.rowColorSetting ?? {
    field: 'name',
    scale: undefined,
    domain: [],
    range: [],
  }
  return {
    editableSources,
    dialogSources: editableSources,
    applyRowEdits: jest.fn(),
    resetRowArrangement: jest.fn(),
    rowOrderWillDropTree: jest.fn(() => false),
    rowColorSetting,
    rowColorChoice:
      rowColorSetting.scale === 'none' ? '' : rowColorSetting.field,
    rowColorFields: [],
    rowColorsFor: previewOf(editableSources),
    ...overrides,
  }
}

const GROUPED: Src[] = [
  { name: 'a', group: 'g1' },
  { name: 'b', group: 'g2' },
  { name: 'c', group: 'g1' },
]

const TWO_COLOR_COLUMNS: ColorColumn<Src>[] = [
  { field: 'color', headerName: 'Track color' },
  { field: 'labelColor', headerName: 'Label color' },
]

function setup(model: TreeLayoutModel<Src>) {
  const handleClose = jest.fn()
  render(<SetColorDialog model={model} handleClose={handleClose} />)
  return { handleClose }
}

function submitted(model: TreeLayoutModel<Src>) {
  const calls = (model.applyRowEdits as jest.Mock).mock.calls
  return calls[calls.length - 1] as [Src[], Record<string, unknown>]
}

test('Submit persists the layout and closes when no tree would be cleared', () => {
  const model = fakeModel()
  const { handleClose } = setup(model)

  fireEvent.click(screen.getByText('Submit'))

  expect(model.applyRowEdits).toHaveBeenCalledWith(model.editableSources, {
    field: 'name',
  })
  expect(handleClose).toHaveBeenCalled()
  expect(screen.queryByText(/Clear cluster tree/)).toBeNull()
})

test('Submit warns first when it would invalidate a loaded cluster tree', () => {
  const model = fakeModel({ rowOrderWillDropTree: jest.fn(() => true) })
  const { handleClose } = setup(model)

  fireEvent.click(screen.getByText('Submit'))

  // warning shown, nothing committed yet
  expect(screen.getByText(/Clear cluster tree/)).toBeInTheDocument()
  expect(model.applyRowEdits).not.toHaveBeenCalled()
  expect(handleClose).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Continue'))
  expect(model.applyRowEdits).toHaveBeenCalled()
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

// "Start from" is how a reader colours by an attribute and then changes one
// row: a one-off copy onto the rows, in the column the grid edits.
test('Start from copies the attribute colors onto the active color column', () => {
  const model = fakeModel({
    editableSources: GROUPED,
    rowColorFields: ['group'],
  })
  render(
    <SetColorDialog
      model={model}
      handleClose={jest.fn()}
      colorColumns={TWO_COLOR_COLUMNS}
      defaultColorField="labelColor"
    />,
  )

  fireEvent.mouseDown(screen.getByLabelText('Start from'))
  fireEvent.click(screen.getByRole('option', { name: 'Group colors' }))
  fireEvent.click(screen.getByText('Submit'))

  const [rows, rowColor] = submitted(model)
  expect(rows.map(s => s.labelColor)).toEqual(['#111111', '#222222', '#111111'])
  expect(rows.every(s => s.color === undefined)).toBe(true)
  expect(rowColor).toEqual({ field: 'name' })
})

test('Clear row colors unsets only the active column', () => {
  const model = fakeModel({
    editableSources: [{ name: 'a', color: '#f00', labelColor: '#0f0' }],
  })
  render(
    <SetColorDialog
      model={model}
      handleClose={jest.fn()}
      colorColumns={TWO_COLOR_COLUMNS}
      defaultColorField="labelColor"
    />,
  )

  fireEvent.click(screen.getByText('Clear row colors'))
  fireEvent.click(screen.getByText('Submit'))

  const [rows] = submitted(model)
  expect(rows[0]!.labelColor).toBeUndefined()
  expect(rows[0]!.color).toBe('#f00')
})

describe('colored by an attribute', () => {
  const byGroup = () =>
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'group',
        scale: undefined,
        domain: ['g2'],
        range: ['#abcdef'],
      },
    })

  test('lists each value with its rows, and the rows show its color unedited', () => {
    const model = byGroup()
    setup(model)

    const values = within(screen.getByTestId('row-color-values'))
    expect(values.getByText('g1')).toBeInTheDocument()
    expect(values.getByText('2 rows')).toBeInTheDocument()
    expect(values.getByText('1 row')).toBeInTheDocument()
    expect(
      screen.getAllByTestId('row-color-swatch').map(s => s.style.background),
    ).toEqual(['rgb(17, 17, 17)', 'rgb(171, 205, 239)', 'rgb(17, 17, 17)'])
    expect(screen.queryByText('Clear row colors')).toBeNull()
  })

  test('Submit writes the attribute and its colors', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: ['g2'],
      range: ['#abcdef'],
    })
  })

  test('Reset returns every value to the palette', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByText('Reset Group colors'))
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: [],
      range: [],
    })
  })

  test('None keeps the attribute and its colors for the way back', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'group',
      scale: 'none',
      domain: ['g2'],
      range: ['#abcdef'],
    })
  })
})

test('None keeps the attribute last chosen in the sitting', () => {
  const model = fakeModel({
    editableSources: GROUPED,
    rowColorFields: ['group'],
  })
  setup(model)

  fireEvent.click(screen.getByRole('button', { name: 'Group' }))
  fireEvent.click(screen.getByRole('button', { name: 'None' }))
  fireEvent.click(screen.getByText('Submit'))

  expect(submitted(model)[1]).toEqual({
    field: 'group',
    scale: 'none',
    domain: [],
    range: [],
  })
})

test('a color by the display does not offer still shows as chosen', () => {
  setup(
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'tissue',
        scale: undefined,
        domain: [],
        range: [],
      },
    }),
  )
  expect(screen.getByRole('button', { name: 'Tissue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

// Regression: the warning must consult the model live, not a snapshot taken at
// render. Clearing custom settings drops the tree, so a subsequent Submit must
// not pop the (now-spurious) warning.
test('no spurious warning after Clear custom settings drops the tree', () => {
  const rowOrderWillDropTree = jest.fn(() => true)
  const resetRowArrangement = jest.fn(() => {
    rowOrderWillDropTree.mockReturnValue(false)
  })
  const model = fakeModel({ rowOrderWillDropTree, resetRowArrangement })
  setup(model)

  fireEvent.click(screen.getByText('Clear custom settings'))
  expect(resetRowArrangement).toHaveBeenCalled()

  fireEvent.click(screen.getByText('Submit'))
  expect(screen.queryByText(/Clear cluster tree/)).toBeNull()
  expect(model.applyRowEdits).toHaveBeenCalled()
})

// The display's own colour, on one line above the rows. It is held here and
// written in submit(), which is what the dead `displayControls` prop promised
// not to do.
describe('the plot color line', () => {
  const PLOT = {
    above: '#b2182b',
    below: '#2166ac',
    mode: 'edit' as const,
  }

  test('an untouched line writes no colour, and Cancel writes nothing at all', () => {
    const model = fakeModel()
    const onSubmit = jest.fn()
    render(
      <SetColorDialog
        model={model}
        handleClose={jest.fn()}
        plotColor={{ ...PLOT, onSubmit }}
      />,
    )

    expect(screen.getByTestId('plot-color-row')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(model.applyRowEdits).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Submit'))
    expect(model.applyRowEdits).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('a picture two colours cannot say reads out beside its reason', () => {
    render(
      <SetColorDialog
        model={fakeModel()}
        handleClose={jest.fn()}
        plotColor={{
          ...PLOT,
          mode: 'read',
          reason: 'a gradient paints this plot',
          onSubmit: jest.fn(),
        }}
      />,
    )

    const line = within(screen.getByTestId('plot-color-row'))
    expect(line.getByText('a gradient paints this plot')).toBeInTheDocument()
    expect(line.queryByTitle(/click to set a custom color/)).toBeNull()
  })

  test('Edit as JSON... hands over and closes, writing nothing', () => {
    const model = fakeModel()
    const handleClose = jest.fn()
    const onEditAsJson = jest.fn()
    render(
      <SetColorDialog
        model={model}
        handleClose={handleClose}
        onEditAsJson={onEditAsJson}
      />,
    )

    fireEvent.click(screen.getByText('Edit as JSON...'))
    expect(onEditAsJson).toHaveBeenCalled()
    expect(handleClose).toHaveBeenCalled()
    expect(model.applyRowEdits).not.toHaveBeenCalled()
  })
})

// One row has nothing to arrange, so the dialog is the plot colour and the
// buttons — the whole colour UI a single-source track needs.
test('showRows false drops the row choice, the grid and the bulk editor', () => {
  render(
    <SetColorDialog
      model={fakeModel({ editableSources: [{ name: 'a' }] })}
      handleClose={jest.fn()}
      enableBulkEdit
      showRows={false}
      plotColor={{
        above: '#b2182b',
        below: '#2166ac',
        mode: 'edit',
        onSubmit: jest.fn(),
      }}
    />,
  )

  expect(screen.getByTestId('plot-color-row')).toBeInTheDocument()
  expect(screen.queryByText('Color rows by')).toBeNull()
  expect(screen.queryByText('Bulk row editor')).toBeNull()
  expect(screen.queryByRole('grid')).toBeNull()
})
