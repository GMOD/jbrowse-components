import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { dealtValueColors } from './rowColorScale.ts'
import { treeSidebarConfigSchemaFields } from './treeSidebarConfigSchemaFields.ts'

const configSchema = ConfigurationSchema('RowColorKeyDisplay', {
  ...treeSidebarConfigSchemaFields({
    tree: 'show the tree',
    rowLabels: 'draw each row name',
  }),
  rows: rowArrangementConfigSchema,
  rowColor: rowColorConfigSchema,
})

interface TestRow {
  name: string
  label?: string
  group?: string
  color?: string
}

const GROUPED: TestRow[] = [
  { name: 'a', group: 'x' },
  { name: 'b', group: 'y' },
  { name: 'c', group: 'x' },
  { name: 'd', group: '' },
  { name: 'e' },
]

const p = rowPaletteColorAt

function makeDisplay(
  configuration: Record<string, unknown> = {},
  {
    rows = GROUPED,
    shared = false,
  }: { rows?: TestRow[]; shared?: boolean } = {},
) {
  return types
    .compose(
      'RowColorKeyDisplay',
      TreeSidebarMixin(),
      types.model({
        type: types.literal('RowColorKeyDisplay'),
        configuration: configSchema,
      }),
    )
    .volatile(() => ({ rows, scrollTop: 5 }))
    .views(self => ({
      get discoveredRows() {
        return self.rows
      },
      get sharesPanel() {
        return shared
      },
    }))
    .actions(self => ({
      setScrollTop(top: number) {
        self.scrollTop = top
      },
    }))
    .create({ type: 'RowColorKeyDisplay', configuration })
}

const entriesOf = (display: ReturnType<typeof makeDisplay>) =>
  (display.rowColorScales[0]?.entries ?? []).map(({ value, label, color }) => ({
    value,
    label,
    color,
  }))

describe('when the row colour key shows', () => {
  it('shows by an attribute on stacked rows, titled by the field', () => {
    const display = makeDisplay({ rowColor: 'group' })
    expect(display.rowColorScales[0]).toMatchObject({
      id: 'rowColor',
      title: 'Group',
      focusesRows: true,
    })
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: p(0) },
      { value: 'y', label: 'y', color: p(1) },
    ])
  })

  it('shows nothing by name on stacked rows, whose labels are the key', () => {
    const display = makeDisplay({
      rowColor: { domain: ['a'], range: ['#00f'] },
    })
    expect(display.resolvedRowColors.get('a')).toBe('#00f')
    expect(display.rowColorScales).toEqual([])
  })

  it('shows by name in a shared panel, a row under its label', () => {
    const display = makeDisplay(
      { rows: { labels: { b: 'Bee' } } },
      {
        rows: [{ name: 'a' }, { name: 'b' }, { name: 'c', color: '#0c0c0c' }],
        shared: true,
      },
    )
    expect(entriesOf(display)).toEqual([
      { value: 'a', label: 'a', color: p(0) },
      { value: 'b', label: 'Bee', color: p(1) },
      { value: 'c', label: 'c', color: '#0c0c0c' },
    ])
  })
})

describe('the entries', () => {
  it('list the pairs first, then the values in the order dealt', () => {
    const display = makeDisplay({
      rowColor: { field: 'group', domain: ['y'], range: ['#00f'] },
    })
    expect(entriesOf(display).map(e => e.value)).toEqual(['y', 'x'])
  })

  it('list "(no value)" last where a pair colours the rows with none', () => {
    const display = makeDisplay({
      rowColor: { field: 'group', domain: [''], range: ['#eee'] },
    })
    expect(display.resolvedRowColors.get('e')).toBe('#eee')
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: p(0) },
      { value: 'y', label: 'y', color: p(1) },
      { value: expect.any(String), label: '(no value)', color: '#eee' },
    ])
  })

  it('list "(no value)" in a row\'s own colour where no pair colours it', () => {
    const display = makeDisplay(
      { rowColor: 'group' },
      {
        rows: [
          { name: 'a', group: 'x' },
          { name: 'b', color: '#123456' },
        ],
      },
    )
    expect(entriesOf(display).at(-1)).toEqual({
      value: expect.any(String),
      label: '(no value)',
      color: '#123456',
    })
  })

  it('give an uncoloured row with no value no entry', () => {
    const display = makeDisplay({ rowColor: 'group' })
    expect(entriesOf(display).map(e => e.value)).toEqual(['x', 'y'])
  })

  it(`stop at ${MAX_LEGEND_ITEMS}, then one colourless "+N more"`, () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      name: `r${i}`,
      group: `g${i}`,
    }))
    const { entries } = makeDisplay({ rowColor: 'group' }, { rows })
      .rowColorScales[0]!
    expect(entries).toHaveLength(MAX_LEGEND_ITEMS + 1)
    expect(entries[MAX_LEGEND_ITEMS - 1]!.label).toBe('g19')
    expect(entries.at(-1)).toEqual({ value: '', label: '+5 more' })
  })

  it('end in one "Other" in the unknown colour', () => {
    const display = makeDisplay({
      rowColor: {
        field: 'group',
        domain: ['x'],
        range: ['#00f'],
        unknown: '#ccc',
      },
    })
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: '#00f' },
      { value: expect.any(String), label: 'Other', color: '#ccc' },
    ])
  })

  it("list no Other under unknown: ''", () => {
    const display = makeDisplay({
      rowColor: { field: 'group', domain: ['x'], range: ['#00f'], unknown: '' },
    })
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: '#00f' },
    ])
  })

  it('keep the values a focus hides', () => {
    const display = makeDisplay({ rowColor: 'group' })
    display.setRowFocus(['b'])
    expect(entriesOf(display).map(e => e.value)).toEqual(['x', 'y'])
  })
})

describe('a click on an entry', () => {
  it('focuses the rows it lists, and resets the scroll', () => {
    const display = makeDisplay({ rowColor: 'group' })
    display.focusLegendEntry('rowColor', 'x')
    expect(display.rowFocus).toEqual(['a', 'c'])
    expect(display.scrollTop).toBe(0)
  })

  it('reaches the rows the previous click hid', () => {
    const display = makeDisplay({ rowColor: 'group' })
    display.focusLegendEntry('rowColor', 'x')
    display.focusLegendEntry('rowColor', 'y')
    expect(display.rowFocus).toEqual(['b'])
  })

  it('on Other focuses the rows that took the unknown colour', () => {
    const display = makeDisplay({
      rowColor: {
        field: 'group',
        domain: ['x'],
        range: ['#00f'],
        unknown: '#ccc',
      },
    })
    const other = display.rowColorScales[0]!.entries.at(-1)!
    display.focusLegendEntry('rowColor', other.value)
    expect(display.rowFocus).toEqual(['b'])
  })

  it('on "(no value)" focuses the rows with no value', () => {
    const display = makeDisplay({
      rowColor: { field: 'group', domain: [''], range: ['#eee'] },
    })
    const noValue = display.rowColorScales[0]!.entries.at(-1)!
    display.focusLegendEntry('rowColor', noValue.value)
    expect(display.rowFocus).toEqual(['d', 'e'])
  })

  it('on "+N more" or another scale changes nothing', () => {
    const display = makeDisplay({ rowColor: 'group' })
    display.setRowFocus(['b'])
    display.focusLegendEntry('rowColor', '')
    display.focusLegendEntry('features', 'x')
    expect(display.rowFocus).toEqual(['b'])
  })
})

test("dealtValueColors reads no row by name under unknown: ''", () => {
  const rowsOf = jest.fn(() => [{ name: 'a' }, { name: 'b' }])
  const dealt = dealtValueColors(
    {
      field: 'name',
      domain: ['a'],
      range: ['#f00'],
      unknown: '',
    },
    rowsOf,
    true,
  )
  expect(Object.fromEntries(dealt)).toEqual({ a: '#f00' })
  expect(rowsOf).not.toHaveBeenCalled()
})
