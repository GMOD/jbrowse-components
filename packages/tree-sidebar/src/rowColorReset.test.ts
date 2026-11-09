import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'

// A bare model has no track and so no base; the base is what a reset returns
// to, so this file stands one in.
let mockBase: Record<string, unknown> = {}
jest.mock('@jbrowse/core/util/baseDisplayConfig', () => ({
  baseDisplayConfig: () => mockBase,
}))

const configSchema = ConfigurationSchema('ResetTreeDisplay', {
  rows: rowsConfigSchema,
})

function makeDisplay(base: Record<string, unknown>) {
  mockBase = base
  return types
    .compose(
      'ResetTreeDisplay',
      TreeSidebarMixin(),
      types.model({
        type: types.literal('ResetTreeDisplay'),
        configuration: configSchema,
      }),
    )
    .views(() => ({
      get discoveredRows() {
        return [
          { name: 'a', group: 'x' },
          { name: 'b', group: 'y' },
          { name: 'c', group: 'x' },
        ]
      },
    }))
    .create({ type: 'ResetTreeDisplay', configuration: base })
}

const colorsOf = (display: {
  resolvedRowColors: ReadonlyMap<string, string>
}) => Object.fromEntries(display.resolvedRowColors)

test("one reset returns a value recolor to the base's grey", () => {
  const display = makeDisplay({
    rows: { color: { field: 'group', scale: { unknown: '#ccc' } } },
  })
  expect(display.rowColorIsCustom).toBe(false)
  display.applyRowEdits(display.editableSources, {
    color: {
      field: 'group',
      scale: { domain: ['y'], range: ['#abcdef'], unknown: '#ccc' },
    },
  })
  expect(display.rowColorIsCustom).toBe(true)
  expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#abcdef', c: '#ccc' })

  display.resetRowArrangement()

  expect(display.rowColorSetting.scale.unknown).toBe('#ccc')
  expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#ccc', c: '#ccc' })
  expect(display.rowColorIsCustom).toBe(false)
})

test('a color by picked over name pairs survives a reset', () => {
  const display = makeDisplay({
    rows: { colors: { a: '#f00' } },
  })
  display.applyRowEdits(display.editableSources, {
    color: { field: 'group' },
  })
  expect(display.rowColorIsCustom).toBe(false)

  display.resetRowArrangement()

  expect(display.rowColorChoice).toBe('group')
})

test("a row recolored under name resets to the base's pairs", () => {
  const display = makeDisplay({
    rows: { colors: { a: '#f00' } },
  })
  display.applyRowEdits(display.editableSources, {
    colors: { a: '#f00', b: '#00f' },
  })
  expect(display.rowArrangementIsCustom).toBe(true)

  display.resetRowArrangement()

  expect(colorsOf(display)).toEqual({ a: '#f00' })
  expect(display.rowArrangementIsCustom).toBe(false)
})

// `rows.annotations` names no row, so no reset returns it and it never makes
// the arrangement custom, as `rows.color`'s choice and `rows.axis` do not.
test('a reset keeps rows.annotations, which is no part of the arrangement', () => {
  const display = makeDisplay({ rows: { sort: ['a', 'b', 'c'] } })
  setConf(display, ['rows', 'annotations'], ['group'])
  expect(display.rowArrangementIsCustom).toBe(false)
  display.setRowOrder(['c', 'b', 'a'].map(name => ({ name })))
  expect(display.rowArrangementIsCustom).toBe(true)

  display.resetRowArrangement()

  expect(display.rowSort).toEqual(['a', 'b', 'c'])
  expect(display.rowArrangementIsCustom).toBe(false)
  expect(display.rowAnnotationChannels.map(a => a.field)).toEqual(['group'])
  expect(display.rowAnnotationColors).toHaveLength(1)
})
