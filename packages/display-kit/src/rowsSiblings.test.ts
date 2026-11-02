import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const schema = ConfigurationSchema('SiblingsDisplay', {
  rows: rowsConfigSchema,
})

// Each member written where its same-word sibling belongs, and the sibling
// the refusal names (ADR-257).
const SWAPS: [string, unknown, string][] = [
  ['color', { NA12878: 'red' }, 'rows.colors'],
  ['colors', 'population', 'rows.color'],
  ['labels', false, 'rows.axis.labels'],
  ['tree', false, 'rows.axis.tree'],
]

test.each(SWAPS)(
  'a write of rows.%s %j points at %s',
  (member, value, sibling) => {
    const rows: AnyConfigurationModel = schema.create({}).rows
    expect(() => {
      setConf(rows, member, value)
    }).toThrow(sibling)
  },
)

test.each(SWAPS)(
  'a config loading rows.%s %j names %s',
  (member, value, sibling) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    let thrown = ''
    try {
      schema.create({ rows: { [member]: value } })
    } catch (error) {
      thrown = String(error)
    }
    const said = [thrown, ...warn.mock.calls.map(call => String(call[0]))]
    expect(said.some(line => line.includes(sibling))).toBe(true)
    warn.mockRestore()
  },
)

// R's NA and Python's None write null: one such entry costs itself, not the
// pins beside it.
test('a map loading an entry that is no string keeps the others', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = schema.create({
    rows: { colors: { HG002: 'red', HG003: null } },
  })
  expect(getSnapshot(conf.rows).colors).toEqual({ HG002: 'red' })
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('loading without HG003'),
  )
  warn.mockRestore()
  const rows: AnyConfigurationModel = schema.create({}).rows
  expect(() => {
    setConf(rows, 'colors', { HG002: 'red', HG003: null })
  }).toThrow(/stringMap slot and cannot take/)
})
