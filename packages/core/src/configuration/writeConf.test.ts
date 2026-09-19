import { getSnapshot, setTypeChecking, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { readConfObject, writeConf } from './index.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const valueScale = ConfigurationSchema('ValueScale', {
  type: {
    type: 'stringEnum',
    model: types.enumeration('', ['linear', 'log']),
    defaultValue: 'linear',
  },
  domainMin: { type: 'maybeNumber' },
  domainMax: { type: 'maybeNumber' },
})

const scales = ConfigurationSchema('Scales', { y: valueScale })

const facet = ConfigurationSchema(
  'Facet',
  {
    field: { type: 'string', defaultValue: '' },
    domain: { type: 'stringArray', defaultValue: [] },
  },
  { shorthand: 'field', closed: true },
)

const display = ConfigurationSchema('Display', {
  height: { type: 'number', defaultValue: 100 },
  scales,
  facet,
})

const holder = types.model({ configuration: display })

function model() {
  return holder.create(undefined, { pluginManager })
}

describe('a drilled node writes one member', () => {
  test('and leaves the object around it alone', () => {
    const m = model()
    writeConf(m.configuration.scales.y, 'type', 'log')
    writeConf(m.configuration.scales.y, 'domainMin', 1)
    writeConf(m.configuration.scales.y, 'domainMax', 9)
    expect(readConfObject(m.configuration, ['scales', 'y', 'type'])).toBe('log')
    expect(readConfObject(m.configuration, ['scales', 'y', 'domainMin'])).toBe(
      1,
    )
  })
})

describe('the same call on the parent writes the object whole', () => {
  test('through the schema shorthand and its closed check', () => {
    const m = model()
    writeConf(m.configuration, 'facet', { field: 'source', domain: ['a', 'b'] })
    writeConf(m.configuration, 'facet', 'biotype')
    expect(readConfObject(m.configuration, ['facet', 'field'])).toBe('biotype')
    expect(readConfObject(m.configuration, ['facet', 'domain'])).toEqual([])
    expect(() => {
      writeConf(m.configuration, 'facet', { field: 'source', nope: ['red'] })
    }).toThrow()
  })

  test('an empty object clears it', () => {
    const m = model()
    writeConf(m.configuration, 'facet', { field: 'source' })
    writeConf(m.configuration, 'facet', {})
    expect(readConfObject(m.configuration, ['facet', 'field'])).toBe('')
    expect(Object.keys(getSnapshot(m.configuration))).not.toContain('facet')
  })
})

describe('the two setSlot guards survive', () => {
  test("ADR-052's membership throw, on the drilled node", () => {
    const m = model()
    expect(() => {
      writeConf(m.configuration.scales.y, 'domainMinn' as any, 5)
    }).toThrow(/ValueScale has no config slot "domainMinn"/)
    expect(() => {
      writeConf(m.configuration, 'hieght' as any, 5)
    }).toThrow(/Display has no config slot "hieght"/)
  })

  test('the value-type throw, with MST type checking off', () => {
    const m = model()
    setTypeChecking(false)
    try {
      expect(() => {
        writeConf(m.configuration.scales.y, 'domainMin', 'low')
      }).toThrow(/ValueScale.domainMin is a maybeNumber slot/)
      expect(() => {
        writeConf(m.configuration, 'height', 'big')
      }).toThrow(/Display.height is a number slot/)
    } finally {
      setTypeChecking(undefined)
    }
    expect(readConfObject(m.configuration, 'height')).toBe(100)
  })
})
