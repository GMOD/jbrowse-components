import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'

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
