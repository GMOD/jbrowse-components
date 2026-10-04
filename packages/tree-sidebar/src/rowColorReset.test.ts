import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { treeSidebarConfigSchemaFields } from './treeSidebarConfigSchemaFields.ts'

// A bare model has no track and so no base; the base is what a reset returns
// to, so this file stands one in.
let mockBase: Record<string, unknown> = {}
jest.mock('@jbrowse/core/util/baseDisplayConfig', () => ({
  baseDisplayConfig: () => mockBase,
}))

const configSchema = ConfigurationSchema('ResetTreeDisplay', {
  ...treeSidebarConfigSchemaFields({ tree: 't', rowLabels: 'r' }),
  rows: rowArrangementConfigSchema,
  rowColor: rowColorConfigSchema,
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

test("one reset returns a value recolour to the base's grey", () => {
  const display = makeDisplay({ rowColor: { field: 'group', unknown: '#ccc' } })
  expect(display.rowStylingIsCustom).toBe(false)
  display.applyRowEdits(display.editableSources, {
    field: 'group',
    domain: ['y'],
    range: ['#abcdef'],
    unknown: '#ccc',
  })
  expect(display.rowStylingIsCustom).toBe(true)
  expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#abcdef', c: '#ccc' })

  display.resetRowArrangement()

  expect(display.rowColorSetting.unknown).toBe('#ccc')
  expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#ccc', c: '#ccc' })
  expect(display.rowStylingIsCustom).toBe(false)
})

test('a colour by picked over name pairs survives a reset', () => {
  const display = makeDisplay({
    rowColor: { domain: ['a'], range: ['#f00'] },
  })
  display.applyRowEdits(display.editableSources, { field: 'group' })
  expect(display.rowStylingIsCustom).toBe(false)

  display.resetRowArrangement()

  expect(display.rowColorChoice).toBe('group')
})

test("a row recoloured under name resets to the base's pairs", () => {
  const display = makeDisplay({
    rowColor: { domain: ['a'], range: ['#f00'] },
  })
  const [a, b, c] = display.editableSources
  display.applyRowEdits([a!, { ...b!, rowColor: '#00f' }, c!])
  expect(display.rowStylingIsCustom).toBe(true)

  display.resetRowArrangement()

  expect(colorsOf(display)).toEqual({ a: '#f00' })
  expect(display.rowStylingIsCustom).toBe(false)
})
