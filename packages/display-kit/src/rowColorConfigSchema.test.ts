import {
  ConfigurationSchema,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

const display = ConfigurationSchema(
  'RowColorTestDisplay',
  { rows: rowsConfigSchema },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const NAME_PAIRS = { scale: { domain: ['a'], range: ['#f00'] } }

// Per-row pairs live only in rows.colors (ADR-257): rows.color under `name`
// keeps its palette and unknown, and takes no domain.
test('rows.color under name refuses scale.domain on a write, pointing at rows.colors', () => {
  const conf = display.create({ displayId: 'write' })
  expect(() => {
    setConf(conf, ['rows', 'color'], NAME_PAIRS)
  }).toThrow(/^rows\.color\.scale\.domain: .*rows\.colors/)
  expect(() => {
    setConf(conf, ['rows', 'color'], {
      scale: { range: ['#f00'], unknown: '' },
    })
  }).not.toThrow()
  setConf(conf, ['rows', 'color'], { field: 'group', ...NAME_PAIRS })
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'domain'])).toEqual([
    'a',
  ])
})

test('rows.color under name loads without a scale.domain, naming it', () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = display.create({
    displayId: 'load',
    rows: { color: NAME_PAIRS },
  })
  expect(spy.mock.calls.map(([m]) => m)).toEqual([
    expect.stringMatching(/scale\.domain: .*rows\.colors.*loading without it$/),
  ])
  spy.mockRestore()
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'domain'])).toEqual([])
})
