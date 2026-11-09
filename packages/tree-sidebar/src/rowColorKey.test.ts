import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { dealValueColors } from './rowColorScale.ts'

const configSchema = ConfigurationSchema('RowColorKeyDisplay', {
  rows: rowsConfigSchema,
})

interface TestRow {
  name: string
  label?: string
  group?: string
  sex?: string
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

describe('when the row color key shows', () => {
  it('shows by an attribute on stacked rows, titled by the field', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    expect(display.rowColorScales[0]).toMatchObject({
      id: 'rows.color',
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
      rows: { colors: { a: '#00f' } },
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
      rows: {
        color: { field: 'group', scale: { domain: ['y'], range: ['#00f'] } },
      },
    })
    expect(entriesOf(display).map(e => e.value)).toEqual(['y', 'x'])
  })

  it('list "(no value)" last where a pair colors the rows with none', () => {
    const display = makeDisplay({
      rows: {
        color: { field: 'group', scale: { domain: [''], range: ['#eee'] } },
      },
    })
    expect(display.resolvedRowColors.get('e')).toBe('#eee')
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: p(0) },
      { value: 'y', label: 'y', color: p(1) },
      { value: expect.any(String), label: '(no value)', color: '#eee' },
    ])
  })

  it('list "(no value)" in a row\'s own color where no pair colors it', () => {
    const display = makeDisplay(
      { rows: { color: 'group' } },
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

  it('give an uncolored row with no value no entry', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    expect(entriesOf(display).map(e => e.value)).toEqual(['x', 'y'])
  })

  it(`list every value past ${MAX_LEGEND_ITEMS}, never summarized`, () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      name: `r${i}`,
      group: `g${i}`,
    }))
    const scale = makeDisplay({ rows: { color: 'group' } }, { rows })
      .rowColorScales[0]!
    expect(scale.entries).toHaveLength(25)
    expect(scale.entries.at(-1)!.label).toBe('g24')
    expect(scale.summarize).toBeUndefined()
  })

  it('end in one "Other" in the unknown color', () => {
    const display = makeDisplay({
      rows: {
        color: {
          field: 'group',
          scale: { domain: ['x'], range: ['#00f'], unknown: '#ccc' },
        },
      },
    })
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: '#00f' },
      { value: expect.any(String), label: 'Other', color: '#ccc' },
    ])
  })

  it("list no Other under unknown: ''", () => {
    const display = makeDisplay({
      rows: {
        color: {
          field: 'group',
          scale: { domain: ['x'], range: ['#00f'], unknown: '' },
        },
      },
    })
    expect(entriesOf(display)).toEqual([
      { value: 'x', label: 'x', color: '#00f' },
    ])
  })

  it('keep the values a focus hides', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    display.setRowFocus(['b'])
    expect(entriesOf(display).map(e => e.value)).toEqual(['x', 'y'])
  })
})

// A pin is no value of the attribute: the pinned row leaves its value's
// entry, which stays while another row carries the value, and takes its own
// entry by label.
describe('a row rows.colors pins under an attribute', () => {
  const pinned = () =>
    makeDisplay({
      rows: {
        color: 'group',
        colors: { b: '#123456', c: '#654321' },
        labels: { b: 'Bee' },
      },
    })

  it('takes its own entry by label after the values, its value left to the other rows', () => {
    expect(entriesOf(pinned())).toEqual([
      { value: 'x', label: 'x', color: p(0) },
      { value: '\u0000pinned:b', label: 'Bee', color: '#123456' },
      { value: '\u0000pinned:c', label: 'c', color: '#654321' },
    ])
  })

  it('is focused by a click on its entry, and its value by the value', () => {
    const display = pinned()
    display.focusLegendEntry('rows.color', '\u0000pinned:b')
    expect(display.rowFocus).toEqual(['b'])
    display.focusLegendEntry('rows.color', 'x')
    expect(display.rowFocus).toEqual(['a'])
  })

  it('keys by name with the pins as the pairs, a pin no entry of its own', () => {
    const display = makeDisplay(
      { rows: { colors: { b: '#123456' } } },
      { shared: true },
    )
    expect(entriesOf(display).map(e => e.value)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(entriesOf(display)[1]).toEqual({
      value: 'b',
      label: 'b',
      color: '#123456',
    })
  })
})

// `rows.annotations` colors no row and reorders none: each entry is a column
// beside the labels with a key of its own after the row color's.
describe('rows.annotations', () => {
  const SEXED: TestRow[] = [
    { name: 'a', group: 'x', sex: 'f' },
    { name: 'b', group: 'y', sex: 'm' },
    { name: 'c', group: 'x', sex: 'f' },
    { name: 'd', group: '' },
  ]
  const SEX = {
    field: 'sex',
    scale: { domain: ['m'], range: ['#00f'] },
  }
  const keysOf = (display: ReturnType<typeof makeDisplay>) =>
    display.rowColorScales.map(({ id, title, focusesRows, entries }) => ({
      id,
      title,
      focusesRows,
      entries: entries.map(({ value, color }) => [value, color]),
    }))

  it('adds one key per annotation, after the row color key', () => {
    const display = makeDisplay(
      { rows: { color: 'group', annotations: ['group', SEX] } },
      { rows: SEXED },
    )
    expect(keysOf(display)).toEqual([
      {
        id: 'rows.color',
        title: 'Group',
        focusesRows: true,
        entries: [
          ['x', p(0)],
          ['y', p(1)],
        ],
      },
      {
        id: 'rows.annotations.0',
        title: 'Group',
        focusesRows: undefined,
        entries: [
          ['x', p(0)],
          ['y', p(1)],
        ],
      },
      {
        id: 'rows.annotations.1',
        title: 'Sex',
        focusesRows: undefined,
        entries: [
          ['m', '#00f'],
          ['f', p(0)],
        ],
      },
    ])
  })

  it('keys an annotation where rows.color has no key', () => {
    const display = makeDisplay(
      { rows: { annotations: ['sex'] } },
      { rows: SEXED },
    )
    expect(keysOf(display).map(key => key.id)).toEqual(['rows.annotations.0'])
    expect(Object.fromEntries(display.resolvedRowColors)).toEqual({})
  })

  it('gives each row its column color by name, a row with no value none', () => {
    const display = makeDisplay(
      { rows: { annotations: ['group', SEX] } },
      { rows: SEXED },
    )
    expect(display.rowAnnotationColors.map(c => Object.fromEntries(c))).toEqual(
      [
        { a: p(0), b: p(1), c: p(0) },
        { a: p(0), b: '#00f', c: p(0) },
      ],
    )
  })

  it('draws no column and no key for a field no row carries', () => {
    const display = makeDisplay(
      { rows: { annotations: ['population', 'sex'] } },
      { rows: SEXED },
    )
    expect(display.rowAnnotationColors).toHaveLength(1)
    expect(keysOf(display).map(key => key.id)).toEqual(['rows.annotations.1'])
  })

  it('draws no column and no key while the row labels are hidden', () => {
    const display = makeDisplay(
      { rows: { annotations: ['sex'], axis: { labels: false } } },
      { rows: SEXED },
    )
    expect(display.rowAnnotationColors).toEqual([])
    expect(keysOf(display)).toEqual([])
  })

  it('draws no column and no key in a shared panel', () => {
    const display = makeDisplay(
      { rows: { annotations: ['sex'] } },
      { rows: SEXED, shared: true },
    )
    expect(display.rowAnnotationColors).toEqual([])
    expect(keysOf(display).map(key => key.id)).toEqual(['rows.color'])
  })

  it('draws nothing for an annotation on name, whatever its scale', () => {
    const display = makeDisplay(
      {
        rows: { annotations: [{ field: 'name', scale: { unknown: '#ccc' } }] },
      },
      { rows: SEXED },
    )
    expect(display.rowAnnotationColors).toEqual([])
    expect(keysOf(display)).toEqual([])
  })

  it('keys the empty value where the scale colors it', () => {
    const display = makeDisplay(
      {
        rows: {
          annotations: [
            { field: 'sex', scale: { domain: [''], range: ['#ccc'] } },
          ],
        },
      },
      { rows: SEXED },
    )
    expect(display.rowAnnotationColors[0]?.get('d')).toBe('#ccc')
    expect(keysOf(display)[0]?.entries).toContainEqual([
      expect.any(String),
      '#ccc',
    ])
  })

  it('deals once per change to the deal, whatever arranges the rows', () => {
    const display = makeDisplay(
      { rows: { annotations: ['sex'] } },
      { rows: SEXED },
    )
    const deals: unknown[] = []
    const dispose = autorun(() => {
      deals.push(display.rowAnnotationDeals)
    })
    display.setRowFocus(['b'])
    display.setRowOrder(['c', 'b', 'a', 'd'].map(name => ({ name })))
    expect(deals).toHaveLength(1)
    setConf(display, ['rows', 'annotations'], ['group'])
    expect(deals).toHaveLength(2)
    dispose()
  })

  it('leaves a click on an annotation entry inert', () => {
    const display = makeDisplay(
      { rows: { annotations: ['sex'] } },
      { rows: SEXED },
    )
    display.focusLegendEntry('rows.annotations.0', 'f')
    expect(display.rowFocus).toBeUndefined()
  })
})

describe('a click on an entry', () => {
  it('focuses the rows it lists, and resets the scroll', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    display.focusLegendEntry('rows.color', 'x')
    expect(display.rowFocus).toEqual(['a', 'c'])
    expect(display.scrollTop).toBe(0)
  })

  it('reaches the rows the previous click hid', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    display.focusLegendEntry('rows.color', 'x')
    display.focusLegendEntry('rows.color', 'y')
    expect(display.rowFocus).toEqual(['b'])
  })

  it('on Other focuses the rows that took the unknown color', () => {
    const display = makeDisplay({
      rows: {
        color: {
          field: 'group',
          scale: { domain: ['x'], range: ['#00f'], unknown: '#ccc' },
        },
      },
    })
    const other = display.rowColorScales[0]!.entries.at(-1)!
    display.focusLegendEntry('rows.color', other.value)
    expect(display.rowFocus).toEqual(['b'])
  })

  it('on "(no value)" focuses the rows with no value', () => {
    const display = makeDisplay({
      rows: {
        color: { field: 'group', scale: { domain: [''], range: ['#eee'] } },
      },
    })
    const noValue = display.rowColorScales[0]!.entries.at(-1)!
    display.focusLegendEntry('rows.color', noValue.value)
    expect(display.rowFocus).toEqual(['d', 'e'])
  })

  it('on "+N more" or another scale changes nothing', () => {
    const display = makeDisplay({ rows: { color: 'group' } })
    display.setRowFocus(['b'])
    display.focusLegendEntry('rows.color', '')
    display.focusLegendEntry('features', 'x')
    expect(display.rowFocus).toEqual(['b'])
  })
})

test("dealValueColors reads no row by name under unknown: ''", () => {
  const rowsOf = jest.fn(() => [{ name: 'a' }, { name: 'b' }])
  const dealt = dealValueColors(
    { field: 'name', scale: { domain: ['a'], range: ['#f00'], unknown: '' } },
    rowsOf,
    true,
  )
  expect(Object.fromEntries(dealt)).toEqual({ a: '#f00' })
  expect(rowsOf).not.toHaveBeenCalled()
})
