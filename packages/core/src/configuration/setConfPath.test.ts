import { getSnapshot, setTypeChecking, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { readConfObject, setConf } from './index.ts'

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

describe('a path writes one member', () => {
  test('through a holder and through a bare node alike', () => {
    const m = model()
    setConf(m, ['scales', 'y', 'domainMin'], 5)
    setConf(m.configuration, ['scales', 'y', 'domainMax'], 9)
    expect(readConfObject(m.configuration, ['scales', 'y', 'domainMin'])).toBe(
      5,
    )
    expect(readConfObject(m.configuration, ['scales', 'y', 'domainMax'])).toBe(
      9,
    )
  })

  test('and leaves the object around it alone', () => {
    const m = model()
    setConf(m, 'scales', { y: { type: 'log', domainMin: 1 } })
    setConf(m, ['scales', 'y', 'domainMax'], 9)
    expect(readConfObject(m.configuration, ['scales', 'y', 'type'])).toBe('log')
    expect(readConfObject(m.configuration, ['scales', 'y', 'domainMin'])).toBe(
      1,
    )
  })

  test('a one-segment path is the slot it names', () => {
    const m = model()
    setConf(m, 'height', 250)
    expect(readConfObject(m.configuration, 'height')).toBe(250)
  })
})

describe('a bare name whose value is an object writes the object whole', () => {
  test('replacing it, through the schema shorthand and its closed check', () => {
    const m = model()
    setConf(m, 'facet', { field: 'source', domain: ['a', 'b'] })
    setConf(m, 'facet', 'biotype')
    expect(readConfObject(m.configuration, ['facet', 'field'])).toBe('biotype')
    expect(readConfObject(m.configuration, ['facet', 'domain'])).toEqual([])
    expect(() => {
      setConf(m, 'facet', { field: 'source', notASlot: ['red'] })
    }).toThrow()
  })

  test('an empty object clears it', () => {
    const m = model()
    setConf(m, 'facet', { field: 'source' })
    setConf(m, 'facet', {})
    expect(readConfObject(m.configuration, ['facet', 'field'])).toBe('')
    expect(Object.keys(getSnapshot(m.configuration))).not.toContain('facet')
  })
})

describe('the two setSlot guards survive the path walk', () => {
  test("ADR-052's membership throw, at depth", () => {
    const m = model()
    expect(() => {
      setConf(m, ['scales', 'y', 'domainMinn'] as any, 5)
    }).toThrow(/ValueScale has no config slot "domainMinn"/)
    expect(() => {
      setConf(m, 'hieght' as any, 5)
    }).toThrow(/Display has no config slot "hieght"/)
  })

  test('a misspelled sub-schema segment names what is missing', () => {
    const m = model()
    expect(() => {
      setConf(m, ['scales', 'z', 'domainMin'] as any, 5)
    }).toThrow(/ScalesConfigurationSchema has no sub-schema "z"/)
  })

  test('the value-type throw, with MST type checking off', () => {
    const m = model()
    setTypeChecking(false)
    try {
      expect(() => {
        setConf(m, ['scales', 'y', 'domainMin'], 'low')
      }).toThrow(/ValueScale.domainMin is a maybeNumber slot/)
      expect(() => {
        setConf(m, 'height', 'big')
      }).toThrow(/Display.height is a number slot/)
    } finally {
      setTypeChecking(undefined)
    }
    expect(readConfObject(m.configuration, 'height')).toBe(100)
  })
})
