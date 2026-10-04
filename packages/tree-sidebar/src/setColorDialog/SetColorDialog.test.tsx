import '@testing-library/jest-dom'

import React from 'react'

import { fireEvent, render, screen, within } from '@testing-library/react'

import { liftRowColor, rowColorChoiceOf } from '../rowColorChoice.ts'
import SetColorDialog from './SetColorDialog.tsx'

import type { RowColorSnapshot } from '../rowColorChoice.ts'
import type { RowColorSetting } from '../rowColorScale.ts'
import type { TreeLayoutModel } from './SetColorDialog.tsx'

interface Src {
  name: string
  color?: string
  rowColor?: string
  group?: string
}

const PALETTE = ['#111111', '#222222', '#333333']

// A deal of each value of the setting's field, its listed values taking their
// range colour, the rest the palette in first-seen order.
function previewOf(rows: Src[]) {
  return (snapshot: RowColorSnapshot) => {
    const setting = liftRowColor(snapshot)
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
    { name: 'a', rowColor: '#f00' },
    { name: 'b' },
  ]
  const rowColorSetting: RowColorSetting = overrides.rowColorSetting ?? {
    field: 'name',
    domain: [],
    range: [],
  }
  const rowPaletteDeals = overrides.rowPaletteDeals ?? true
  return {
    editableSources,
    dialogSources: editableSources,
    applyRowEdits: jest.fn(),
    resetRowArrangement: jest.fn(),
    rowOrderWillDropTree: jest.fn(() => false),
    rowColorSetting,
    rowColorChoice: rowColorChoiceOf(rowColorSetting, rowPaletteDeals),
    rowPaletteDeals,
    internalRowFields: [],
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

function setup(model: TreeLayoutModel<Src>) {
  const handleClose = jest.fn()
  render(<SetColorDialog model={model} handleClose={handleClose} />)
  return { handleClose }
}

function submitted(model: TreeLayoutModel<Src>) {
  const calls = (model.applyRowEdits as jest.Mock).mock.calls
  return calls[calls.length - 1] as [Src[], Record<string, unknown> | undefined]
}

function pickColor(swatch: Element, from: string, to: string) {
  fireEvent.click(swatch)
  fireEvent.change(screen.getByDisplayValue(from), { target: { value: to } })
}

test('Submit persists the layout and closes when no tree would be cleared', () => {
  const model = fakeModel()
  const { handleClose } = setup(model)

  fireEvent.click(screen.getByText('Submit'))

  expect(model.applyRowEdits).toHaveBeenCalledWith(
    model.editableSources,
    undefined,
  )
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

test("the grid edits one colour column, the rows' rowColor", () => {
  setup(fakeModel())
  expect(
    screen.getByRole('columnheader', { name: 'Color' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Label color' })).toBeNull()
})

// "Start from" is how a reader colours by an attribute and then changes one
// row: a one-off copy onto the rows' colours.
test('Start from copies the attribute colors onto the rows', () => {
  const model = fakeModel({
    editableSources: GROUPED,
    rowColorFields: ['group'],
  })
  setup(model)

  fireEvent.mouseDown(screen.getByLabelText('Start from'))
  fireEvent.click(screen.getByRole('option', { name: 'Group colors' }))
  fireEvent.click(screen.getByText('Submit'))

  const [rows, rowColor] = submitted(model)
  expect(rows.map(s => s.rowColor)).toEqual(['#111111', '#222222', '#111111'])
  expect(rows.every(s => s.color === undefined)).toBe(true)
  expect(rowColor).toEqual({ field: 'name' })
})

test('a touched Each row keeps the unknown colour its config sets', () => {
  const model = fakeModel({
    rowColorSetting: {
      field: 'name',
      domain: ['a'],
      range: ['#f00'],
      unknown: '#cccccc',
    },
  })
  setup(model)

  fireEvent.click(screen.getByText('Clear row colors'))
  fireEvent.click(screen.getByText('Submit'))

  expect(submitted(model)[1]).toEqual({ field: 'name', unknown: '#cccccc' })
})

test("Clear row colors unsets each row's colour and leaves its own", () => {
  const model = fakeModel({
    editableSources: [{ name: 'a', color: '#f00', rowColor: '#0f0' }],
  })
  setup(model)

  fireEvent.click(screen.getByText('Clear row colors'))
  fireEvent.click(screen.getByText('Submit'))

  const [rows] = submitted(model)
  expect(rows[0]!.rowColor).toBeUndefined()
  expect(rows[0]!.color).toBe('#f00')
})

describe('colored by an attribute', () => {
  const byGroup = () =>
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'group',
        domain: ['g2'],
        range: ['#abcdef'],
      },
    })

  test('lists each value with its rows, and the rows show its color unedited', () => {
    const model = byGroup()
    setup(model)

    const values = within(screen.getByTestId('row-color-values'))
    expect(values.getByText('g1').nextElementSibling!.textContent).toBe(
      '2 rows',
    )
    expect(values.getByText('g2').nextElementSibling!.textContent).toBe('1 row')
    expect(
      values.getByText('Other values').nextElementSibling!.textContent,
    ).toBe('2 rows')
    expect(
      screen.getAllByTestId('row-color-swatch').map(s => s.style.background),
    ).toEqual(['rgb(17, 17, 17)', 'rgb(171, 205, 239)', 'rgb(17, 17, 17)'])
    expect(screen.queryByText('Clear row colors')).toBeNull()
  })

  test('an untouched Submit writes no colour object', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toBeUndefined()
  })

  test('a value recolour writes the attribute and its colors', () => {
    const model = byGroup()
    setup(model)

    const values = within(screen.getByTestId('row-color-values'))
    pickColor(
      values.getByText('g2').previousElementSibling!.firstElementChild!,
      '#abcdef',
      '#00ff00',
    )
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: ['g2'],
      range: ['rgb(0, 255, 0)'],
    })
  })

  test('Reset returns every value to the palette', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByText('Reset Group colors'))
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({ field: 'group' })
  })

  test('None writes the rows with no palette, the attribute gone', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name', unknown: '' })
  })

  test('an attribute keeps the unknown its config sets', () => {
    const model = fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'group',
        domain: ['g2'],
        range: ['#abcdef'],
        unknown: '',
      },
    })
    setup(model)

    fireEvent.click(screen.getByText('Reset Group colors'))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'group', unknown: '' })
  })
})

test('None edits the row colors, which stay without the palette', () => {
  const model = fakeModel({
    rowColorSetting: {
      field: 'name',
      domain: ['a'],
      range: ['#f00'],
      unknown: '',
    },
    rowColorChoice: '',
  })
  setup(model)

  fireEvent.click(screen.getByText('Clear row colors'))
  fireEvent.click(screen.getByText('Submit'))

  const [rows, rowColor] = submitted(model)
  expect(rows[0]!.rowColor).toBeUndefined()
  expect(rowColor).toEqual({ field: 'name', unknown: '' })
})

test('None on a display dealing no palette writes the rows alone', () => {
  const model = fakeModel({
    editableSources: GROUPED,
    rowColorFields: ['group'],
    rowColorSetting: {
      field: 'group',
      domain: [],
      range: [],
    },
    rowPaletteDeals: false,
  })
  setup(model)

  fireEvent.click(screen.getByRole('button', { name: 'None' }))
  fireEvent.click(screen.getByText('Submit'))

  expect(submitted(model)[1]).toEqual({ field: 'name' })
})

// A submit names a colour object only where the reader changed a colour, so a
// reorder or relabel leaves the config's as it wrote it.
describe('the colour object a submit passes', () => {
  test('none for an untouched panel', () => {
    const model = fakeModel()
    setup(model)

    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toBeUndefined()
  })

  test('the choice, once the reader changes it', () => {
    const model = fakeModel()
    setup(model)

    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name', unknown: '' })
  })

  test('None, once the reader colours a row under it', () => {
    const model = fakeModel({ rowColorChoice: '' })
    setup(model)

    pickColor(
      screen.getByTitle('Automatic — click to set a custom color'),
      'blue',
      '#00ff00',
    )
    fireEvent.click(screen.getByText('Submit'))

    const [rows, rowColor] = submitted(model)
    expect(rows[1]!.rowColor).toBe('rgb(0, 255, 0)')
    expect(rowColor).toEqual({ field: 'name', unknown: '' })
  })
})

test('a display dealing no palette offers no Each row', () => {
  setup(fakeModel({ rowPaletteDeals: false }))

  expect(screen.getByRole('button', { name: 'None' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Each row' })).toBeNull()
})

test('a color by the display does not offer still shows as chosen', () => {
  setup(
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'tissue',
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

  test('Edit plot... hands over and closes, writing nothing', () => {
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

    fireEvent.click(screen.getByText('Edit plot...'))
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

// A stacked display's config can paint the listed rows and grey the rest
// (`unknown: '#ccc'`); the dialog shows that as None, since no palette deals,
// with the grey on the Other rows swatch, which a recolour of one row keeps
// and Clear row colors takes with the rest.
describe('the Other rows swatch on a stacked display', () => {
  const grey = () =>
    fakeModel({
      rowColorSetting: {
        field: 'name',
        domain: ['a'],
        range: ['#f00'],
        unknown: '#cccccc',
      },
      rowPaletteDeals: false,
    })

  test("shows the config's grey under None, kept past a row recolour", () => {
    const model = grey()
    setup(model)

    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const other = screen.getByText('Other rows').previousElementSibling!
    expect((other.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgb(204, 204, 204)',
    )
    // Row b's swatch: the one automatic colour here, since a is red and the
    // Other rows swatch is grey.
    pickColor(
      screen.getByTitle('Automatic — click to set a custom color'),
      'blue',
      '#00ff00',
    )
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      unknown: '#cccccc',
    })
  })

  test('recolours the grey, and Clear row colors drops it', () => {
    const model = grey()
    setup(model)

    const other = screen.getByText('Other rows').previousElementSibling!
    pickColor(other.firstElementChild!, '#cccccc', '#0000ff')
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({
      field: 'name',
      unknown: 'rgb(0, 0, 255)',
    })
  })

  test('Auto returns the other rows to their own colours; Clear row colors leaves them', () => {
    const model = grey()
    setup(model)

    fireEvent.click(screen.getByText('Clear row colors'))
    fireEvent.click(screen.getByText('Auto'))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name' })
  })
})

test('None with a palette dealing offers no Other rows swatch', () => {
  setup(fakeModel({ rowColorChoice: '' }))
  expect(screen.queryByText('Other rows')).toBeNull()
})

test('an attribute lists Other values with the rows no pair names, and colours them', () => {
  const model = fakeModel({
    editableSources: GROUPED,
    rowColorFields: ['group'],
    rowColorSetting: {
      field: 'group',
      domain: ['g2'],
      range: ['#abcdef'],
    },
  })
  setup(model)

  const values = within(screen.getByTestId('row-color-values'))
  const other = values.getByText('Other values')
  expect(other.nextElementSibling!.textContent).toBe('2 rows')
  pickColor(other.previousElementSibling!.firstElementChild!, 'blue', '#999999')
  fireEvent.click(screen.getByText('Submit'))

  expect(submitted(model)[1]).toEqual({
    field: 'group',
    domain: ['g2'],
    range: ['#abcdef'],
    unknown: 'rgb(153, 153, 153)',
  })
})

test('the value table lists the values in the order the key does', () => {
  const model = fakeModel({
    editableSources: [
      { name: 'a', group: 'g1' },
      { name: 'b', group: 'g2' },
      { name: 'c', group: 'g2' },
      { name: 'd' },
    ],
    rowColorFields: ['group'],
    rowColorSetting: {
      field: 'group',
      domain: ['g2'],
      range: ['#abcdef'],
    },
  })
  setup(model)

  const values = within(screen.getByTestId('row-color-values'))
  expect(
    values.getAllByText(/^g\d$|^\(no value\)$/).map(e => e.textContent),
  ).toEqual(['g2', 'g1', '(no value)'])
})

describe('the Other values swatch', () => {
  // A stacked display, whose None writes no unknown of its own.
  const byGroupPair = () =>
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'group',
        domain: ['g2'],
        range: ['#abcdef'],
      },
      rowPaletteDeals: false,
    })
  const otherValues = () =>
    within(screen.getByTestId('row-color-values')).getByText('Other values')
  const otherCount = () => otherValues().nextElementSibling!.textContent

  test('is held per field, so None after group writes none of it', () => {
    const model = byGroupPair()
    setup(model)

    pickColor(
      otherValues().previousElementSibling!.firstElementChild!,
      'blue',
      '#999999',
    )
    fireEvent.click(screen.getByText('None'))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name' })
  })

  test('counts fewer rows once a value takes a pair of its own', () => {
    setup(byGroupPair())
    expect(otherCount()).toBe('2 rows')

    const values = within(screen.getByTestId('row-color-values'))
    pickColor(
      values.getByText('g1').previousElementSibling!.firstElementChild!,
      '#111111',
      '#00ff00',
    )

    expect(otherCount()).toBe('0 rows')
  })

  test('Clear custom settings drops a colour set on it', () => {
    const model = byGroupPair()
    setup(model)

    pickColor(
      otherValues().previousElementSibling!.firstElementChild!,
      'blue',
      '#999999',
    )
    fireEvent.click(screen.getByText('Clear custom settings'))
    fireEvent.click(screen.getByText('Submit'))

    expect(model.resetRowArrangement).toHaveBeenCalled()
    expect(submitted(model)[1]).toBeUndefined()
  })

  test("a config's '' shows as none with Auto, and Auto deals the palette", () => {
    const model = fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: {
        field: 'group',
        domain: [],
        range: [],
        unknown: '',
      },
    })
    setup(model)

    const swatch = otherValues().previousElementSibling!.firstElementChild!
    expect(swatch.getAttribute('title')).toBeNull()
    fireEvent.click(screen.getByText('Auto'))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'group' })
  })
})
