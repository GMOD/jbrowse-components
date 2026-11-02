import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { applyConfSettings, setConf } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'
import { slotValueRefusal } from './slotFacade.ts'
import { refusingUndeclaredKeys } from './snapshotPreprocess.ts'

const band = ConfigurationSchema(
  'BoundBand',
  {
    size: {
      type: 'number',
      model: types.union(types.number, types.literal('auto')),
      defaultValue: 'auto',
      exclusiveMinimum: 0,
      description: 'the band size in px',
    },
  },
  { writes: 'members' },
)

const display = ConfigurationSchema(
  'BoundDisplay',
  {
    band,
    width: { type: 'number', defaultValue: 3, exclusiveMinimum: 1 },
  },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('a load names a number at or below the bound once and reads the default', () => {
  let conf = display.create({ displayId: 'load0' })
  const warnings = warningsOf(() => {
    conf = display.create({ displayId: 'load1', band: { size: 0 }, width: 1 })
    display.create({ displayId: 'load2', band: { size: 0 }, width: 1 })
  })
  expect(warnings.toSorted()).toEqual([
    'BoundBand.size takes a number above 0 or "auto", not 0: loading the default, "auto"',
    'BoundDisplay.width takes a number above 1, not 1: loading the default, 3',
  ])
  expect(readConfObject(conf, ['band', 'size'])).toBe('auto')
  expect(readConfObject(conf, 'width')).toBe(3)
})

test('a number above the bound and the word load as written', () => {
  const conf = display.create({
    displayId: 'fine',
    band: { size: 0.5 },
    width: 1.5,
  })
  expect(readConfObject(conf, ['band', 'size'])).toBe(0.5)
  expect(readConfObject(conf, 'width')).toBe(1.5)
})

test('a whole write refuses it, naming the bound, the word and the meaning', () => {
  const conf = display.create({ displayId: 'whole' })
  expect(() => {
    setConf(conf, 'band', { size: -2 })
  }).toThrow(
    'band.size takes a number above 0 or "auto", not -2 — the band size in px',
  )
  expect(() =>
    refusingUndeclaredKeys(() => display.create({ displayId: 'w', width: 0 })),
  ).toThrow('BoundDisplay.width takes a number above 1, not 0')
})

test('a single-slot write refuses it and keeps the value', () => {
  const conf = display.create({ displayId: 'slot', band: { size: 4 } })
  expect(() => {
    setConf(conf, ['band', 'size'], 0)
  }).toThrow(
    'band.size takes a number above 0 or "auto", not 0 — the band size in px',
  )
  expect(() => {
    setConf(conf, 'width', -1)
  }).toThrow('BoundDisplay.width takes a number above 1, not -1')
  expect(readConfObject(conf, ['band', 'size'])).toBe(4)
  expect(readConfObject(conf, 'width')).toBe(3)
  setConf(conf, ['band', 'size'], 'auto')
  expect(readConfObject(conf, ['band', 'size'])).toBe('auto')
})

test('a settings bag fails the key alone', () => {
  const conf = display.create({ displayId: 'bag' })
  const report = applyConfSettings(conf, { width: 0, band: { size: 0 } })
  expect(report.applied).toEqual([])
  expect(report.failed.map(f => f.key)).toEqual(['width', 'band'])
  expect(report.failed[0]!.error).toMatch(
    /BoundDisplay\.width takes a number above 1, not 0/,
  )
  expect(report.failed[1]!.error).toMatch(
    /band\.size takes a number above 0 or "auto", not 0/,
  )
  expect(readConfObject(conf, 'width')).toBe(3)
})

test("displayDefaults routing's check refuses it", () => {
  expect(slotValueRefusal(display, 'width', 0)).toBe(
    'BoundDisplay.width takes a number above 1, not 0',
  )
  expect(slotValueRefusal(display, 'band', { size: 0 })).toMatch(
    /^band\.size takes a number above 0 or "auto", not 0/,
  )
  expect(slotValueRefusal(display, 'band', { size: 2 })).toBeUndefined()
})

test('a bound on a slot taking no number, or a default at the bound, is refused', () => {
  expect(() =>
    ConfigurationSchema('BoundString', {
      name: { type: 'string', defaultValue: 'x', exclusiveMinimum: 0 },
    }),
  ).toThrow(/exclusiveMinimum bounds a number, and a "string" slot takes none/)
  expect(() =>
    ConfigurationSchema('BoundDefault', {
      size: { type: 'number', defaultValue: 0, exclusiveMinimum: 0 },
    }),
  ).toThrow(/the defaultValue 0 is not above the slot's exclusiveMinimum, 0/)
})
