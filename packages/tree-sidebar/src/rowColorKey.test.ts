import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { dealValueColors } from './rowColorScale.ts'

const configSchema = ConfigurationSchema('RowColorKeyDisplay', {
  rows: rowsConfigSchema,
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
