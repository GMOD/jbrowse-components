import '@testing-library/jest-dom'

import React from 'react'

import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  liftRowColor,
  rowColorChoiceOf,
  startingRowColor,
} from '../rowColorChoice.ts'
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
const AUTO = 'Automatic — click to set a custom color'

// A deal of each value of the setting's field: its listed values take their
// range colour, the rest `unknown`, or the palette in first-seen order where
// it deals, as `dealtValueColors` does.
function previewOf(rows: Src[], paletteDeals: boolean) {
  return (snapshot: RowColorSnapshot) => {
    const setting = liftRowColor(snapshot)
    const colors = new Map<string, string>()
    setting.domain.forEach((value, i) => colors.set(value, setting.range[i]!))
    const deals =
      setting.unknown !== '' &&
      (setting.field !== 'name' ||
        paletteDeals ||
        setting.unknown !== undefined)
    let next = 0
    for (const row of rows) {
      const value =
        setting.field === 'name'
          ? row.name
          : String((row as unknown as Record<string, unknown>)[setting.field])
      if (deals && !colors.has(value)) {
        colors.set(value, setting.unknown ?? PALETTE[next++ % PALETTE.length]!)
      }
    }
    return colors
  }
}

const EMPTY: RowColorSetting = { field: 'name', domain: [], range: [] }

interface FakeOptions extends Partial<TreeLayoutModel<Src>> {
  rowColorSetting?: RowColorSetting
  baseRowColor?: RowColorSetting
  rowColorFields?: string[]
}

// The model members the dialog reads, derived from a config's `rowColor`, its
// base and the attributes on offer as the mixin derives them.
function fakeModel({
  rowColorSetting = EMPTY,
  baseRowColor = EMPTY,
  rowColorFields = [],
  ...overrides
}: FakeOptions = {}): TreeLayoutModel<Src> {
  const editableSources = overrides.editableSources ?? [
    { name: 'a', rowColor: '#f00' },
    { name: 'b' },
  ]
  const rowPaletteDeals = overrides.rowPaletteDeals ?? true
  const current = rowColorChoiceOf(rowColorSetting, rowPaletteDeals)
  return {
    editableSources,
    applyRowEdits: jest.fn(),
    resetRowArrangement: jest.fn(),
    rowOrderWillDropTree: jest.fn(() => false),
    rowColorChoice: current,
    rowColorAttributesOffered:
      current === '' || current === 'name' || rowColorFields.includes(current)
        ? rowColorFields
        : [...rowColorFields, current],
    rowColorFor: choice =>
      startingRowColor(
        choice,
        [rowColorSetting, baseRowColor],
        rowPaletteDeals,
      ),
    rowPaletteDeals,
    rowAlias: undefined,
    internalRowFields: [],
    dealtRowColorsFor: previewOf(editableSources, rowPaletteDeals),
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

// Picks `to` in the swatch's popover and closes it, as a reader does.
function pickColor(swatch: Element, from: string, to: string) {
  fireEvent.click(swatch)
  const input = screen.getByDisplayValue(from)
  fireEvent.change(input, { target: { value: to } })
  fireEvent.keyDown(input, { key: 'Escape' })
}

function gridRow(name: string) {
  return within(
    screen.getAllByRole('gridcell', { name }).at(-1)!.closest('[role="row"]')!,
  )
}

function choices() {
  return within(screen.getByRole('group', { name: 'Color rows by' }))
}

function choose(label: string) {
  fireEvent.click(choices().getByRole('button', { name: label }))
}

function pressed(label: string) {
  return choices()
    .getByRole('button', { name: label })
    .getAttribute('aria-pressed')
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

test('the grid shows one colour column', () => {
  setup(fakeModel())
  expect(
    screen.getByRole('columnheader', { name: 'Color' }),
  ).toBeInTheDocument()
})

describe('Each row', () => {
  test("picks a row's colour in the row list", () => {
    const model = fakeModel()
    setup(model)
    expect(pressed('Each row')).toBe('true')

    pickColor(gridRow('b').getByTitle(AUTO), '#222222', '#00ff00')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['b'],
      range: ['rgb(0, 255, 0)'],
    })
  })

  test('Clear row colors drops the picks and keeps the Other colour', () => {
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

  test('Other none leaves the rows no pick names uncoloured', () => {
    const model = fakeModel()
    setup(model)

    pickColor(gridRow('b').getByTitle(AUTO), '#222222', '#00ff00')
    fireEvent.click(screen.getByRole('button', { name: 'Other rows: none' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['b'],
      range: ['rgb(0, 255, 0)'],
      unknown: '',
    })
  })

  // Stacked rows take no palette colour by name, so Auto already colours no
  // other row and the swatch offers no None beside it.
  test('a stacked display offers it, and a pick colours that row alone', () => {
    const model = fakeModel({ rowPaletteDeals: false })
    setup(model)
    expect(pressed('None')).toBe('true')

    choose('Each row')
    expect(
      screen.queryByRole('button', { name: 'Other rows: none' }),
    ).toBeNull()
    pickColor(gridRow('b').getByTitle(AUTO), 'blue', '#00ff00')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['b'],
      range: ['rgb(0, 255, 0)'],
    })
  })

  test('a pasted colour column lands as picks', () => {
    const model = fakeModel({ rowPaletteDeals: false })
    setup(model)

    fireEvent.click(screen.getByText('Bulk row editor'))
    fireEvent.change(screen.getByPlaceholderText(/^name,rowColor/), {
      target: { value: 'name,rowColor\nb,#00ff00\na,reddish' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update rows' }))
    expect(pressed('Each row')).toBe('true')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['b'],
      range: ['#00ff00'],
    })
  })
})

// The pasted colour column is Each row's whole pick set, so a blanked cell
// drops that pick.
test('a pasted colour column replaces the picks', () => {
  const model = fakeModel({
    rowColorSetting: { field: 'name', domain: ['a'], range: ['#f00'] },
    rowPaletteDeals: false,
  })
  setup(model)

  fireEvent.click(screen.getByText('Bulk row editor'))
  fireEvent.change(screen.getByPlaceholderText(/^name,rowColor/), {
    target: { value: 'name,rowColor\na,\nb,#00ff00' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Update rows' }))
  fireEvent.click(screen.getByText('Submit'))

  expect(submitted(model)[1]).toEqual({
    field: 'name',
    domain: ['b'],
    range: ['#00ff00'],
  })
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

  test('Clear returns every value to the palette', () => {
    const model = byGroup()
    setup(model)

    fireEvent.click(screen.getByText('Clear Group colors'))
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({ field: 'group' })
  })

  test('None colours nothing', () => {
    const model = byGroup()
    setup(model)

    choose('None')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name', unknown: '' })
  })

  test('Clear keeps the Other colour the config sets', () => {
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

    fireEvent.click(screen.getByText('Clear Group colors'))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'group', unknown: '' })
  })
})

describe('None', () => {
  test('offers no Other swatch, and the rows show their own colours', () => {
    setup(
      fakeModel({
        editableSources: [{ name: 'a', color: '#00ff00' }, { name: 'b' }],
        rowColorSetting: { ...EMPTY, unknown: '' },
      }),
    )
    expect(pressed('None')).toBe('true')
    expect(screen.queryByText('Other rows')).toBeNull()
    expect(
      screen.getAllByTestId('row-color-swatch').map(s => s.style.background),
    ).toEqual(['rgb(0, 255, 0)'])
  })

  test('on a display dealing no palette writes no unknown', () => {
    const model = fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: { ...EMPTY, field: 'group' },
      rowPaletteDeals: false,
    })
    setup(model)

    choose('None')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name' })
  })
})

// A choice starts from the colours it has now, else the config's, so picking
// the config's attribute back after None is the config again.
describe('the colours a choice starts from', () => {
  const overBase = () =>
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: { ...EMPTY, unknown: '' },
      baseRowColor: {
        field: 'group',
        domain: ['g2'],
        range: ['#abcdef'],
        unknown: '#cccccc',
      },
    })

  test("are the config's for the attribute it colours by", () => {
    const model = overBase()
    setup(model)

    choose('Group')
    expect(
      within(screen.getByTestId('row-color-values'))
        .getByText('g2')
        .previousElementSibling!.firstElementChild!.getAttribute('title'),
    ).toBeNull()
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: ['g2'],
      range: ['#abcdef'],
      unknown: '#cccccc',
    })
  })

  test('are the picks left on a choice earlier in the sitting', () => {
    const model = overBase()
    setup(model)

    choose('Group')
    pickColor(
      within(screen.getByTestId('row-color-values')).getByText('g1')
        .previousElementSibling!.firstElementChild!,
      '#cccccc',
      '#00ff00',
    )
    choose('None')
    choose('Group')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: ['g2', 'g1'],
      range: ['#abcdef', 'rgb(0, 255, 0)'],
      unknown: '#cccccc',
    })
  })
})

test('a color by the display does not offer still shows as chosen', () => {
  setup(
    fakeModel({
      editableSources: GROUPED,
      rowColorFields: ['group'],
      rowColorSetting: { ...EMPTY, field: 'tissue' },
    }),
  )
  expect(pressed('Tissue')).toBe('true')
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

// The display's own colour, on one line above the rows, held here and written
// in submit().
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
// (`unknown: '#ccc'`), which is Each row with the grey on the Other rows
// swatch.
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

  test("shows the config's grey under Each row, kept past a row pick", () => {
    const model = grey()
    setup(model)

    expect(pressed('Each row')).toBe('true')
    const other = screen.getByText('Other rows').previousElementSibling!
    expect((other.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgb(204, 204, 204)',
    )
    pickColor(gridRow('b').getByTitle(AUTO), '#cccccc', '#00ff00')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['a', 'b'],
      range: ['#f00', 'rgb(0, 255, 0)'],
      unknown: '#cccccc',
    })
  })

  test('recolours the grey', () => {
    const model = grey()
    setup(model)

    const other = screen.getByText('Other rows').previousElementSibling!
    pickColor(other.firstElementChild!, '#cccccc', '#0000ff')
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['a'],
      range: ['#f00'],
      unknown: 'rgb(0, 0, 255)',
    })
  })

  test('Auto returns the other rows to their own colours', () => {
    const model = grey()
    setup(model)

    fireEvent.click(screen.getByRole('button', { name: 'Other rows: auto' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'name',
      domain: ['a'],
      range: ['#f00'],
    })
  })
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
  pickColor(other.previousElementSibling!.firstElementChild!, 'blue', '#999999')
  expect(values.getByTestId('other-count').textContent).toBe('2 rows')
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
  const otherCount = () => screen.getByTestId('other-count').textContent

  test('is held per choice, so None after group writes none of it', () => {
    const model = byGroupPair()
    setup(model)

    pickColor(
      otherValues().previousElementSibling!.firstElementChild!,
      'blue',
      '#999999',
    )
    choose('None')
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'name' })
  })

  // Under Auto each unpaired value lists its own palette colour, so only a set
  // Other colour has rows to count.
  test('counts its rows only while it holds a colour or None', () => {
    setup(byGroupPair())
    expect(screen.queryByTestId('other-count')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Other values: none' }))
    expect(otherCount()).toBe('2 rows')

    const values = within(screen.getByTestId('row-color-values'))
    pickColor(
      values.getByText('g1').previousElementSibling!.firstElementChild!,
      'blue',
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

  test('None leaves the values no pair names uncoloured', () => {
    const model = byGroupPair()
    setup(model)

    fireEvent.click(screen.getByRole('button', { name: 'Other values: none' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({
      field: 'group',
      domain: ['g2'],
      range: ['#abcdef'],
      unknown: '',
    })
  })

  test("a config's '' shows None pressed, and Auto deals the palette", () => {
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

    expect(
      screen
        .getByRole('button', { name: 'Other values: none' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Other values: auto' }))
    fireEvent.click(screen.getByText('Submit'))

    expect(submitted(model)[1]).toEqual({ field: 'group' })
  })
})
