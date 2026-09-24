import { getSnapshot, setTypeChecking, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { applyConfSettings, readConfObject, setConf } from './index.ts'

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

const searchIndex = ConfigurationSchema(
  'SearchIndex',
  { uri: { type: 'string', defaultValue: '' } },
  { explicitlyTyped: true },
)

const display = ConfigurationSchema('Display', {
  height: { type: 'number', defaultValue: 100 },
  scales,
  facet,
  // `textSearchAdapter`'s spelling: unset until something writes it
  searchIndex: types.union(
    types.optional(types.undefined, undefined),
    searchIndex,
  ),
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

  test('an optional one nobody has written yet', () => {
    const m = model()
    expect(m.configuration.searchIndex).toBeUndefined()
    setConf(m, 'searchIndex', { type: 'SearchIndex', uri: 'genes.ix' })
    expect(readConfObject(m.configuration, ['searchIndex', 'uri'])).toBe(
      'genes.ix',
    )
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

// A settings bag names the members it means, one key per member, and reaches
// them the way setConf does; what it adds is the namespace walk and the
// per-key report a session spec or an agent call needs.
describe('a settings bag', () => {
  test('writes slots and channels whole, and reports what the config does not declare', () => {
    const { configuration } = model()
    const report = applyConfSettings(configuration, {
      height: 55,
      facet: { field: 'HP', domain: ['1'] },
      type: 'Display',
      nonsense: 1,
    })
    expect(report).toEqual({
      applied: ['height', 'facet'],
      undeclared: { type: 'Display', nonsense: 1 },
      failed: [],
    })
    expect(readConfObject(configuration, 'height')).toBe(55)
    applyConfSettings(configuration, { facet: { field: 'HP' } })
    expect(readConfObject(configuration, ['facet', 'domain'])).toEqual([])
  })

  test("writes a namespace's members one by one, keeping the node and the rest", () => {
    const { configuration } = model()
    const y = configuration.scales.y
    applyConfSettings(configuration, { scales: { y: { type: 'log' } } })
    applyConfSettings(configuration, { scales: { y: { domainMin: 5 } } })
    expect(configuration.scales.y).toBe(y)
    expect(readConfObject(configuration, ['scales', 'y'])).toEqual({
      type: 'log',
      domainMin: 5,
    })
    applyConfSettings(configuration, { scales: { y: { domainMin: null } } })
    expect(readConfObject(configuration, ['scales', 'y', 'domainMin'])).toBe(
      undefined,
    )
    applyConfSettings(configuration, { scales: { y: null } })
    expect(readConfObject(configuration, ['scales', 'y', 'type'])).toBe(
      'linear',
    )
  })

  test("runs the config's lift over the bag, and a namespace's over its part", () => {
    const lifted = ConfigurationSchema(
      'Lifted',
      {
        color: { type: 'color', defaultValue: 'red' },
        useBicolor: { type: 'boolean', defaultValue: true },
        rows: ConfigurationSchema(
          'LiftedRows',
          { domain: { type: 'stringArray', defaultValue: [] } },
          {
            preProcessSnapshot: (snap: Record<string, unknown>) =>
              typeof snap.domain === 'string'
                ? { ...snap, domain: snap.domain.split(',') }
                : snap,
          },
        ),
      },
      {
        preProcessSnapshot: (snap: Record<string, unknown>) =>
          snap.color !== undefined && snap.useBicolor === undefined
            ? { ...snap, useBicolor: false }
            : snap,
      },
    )
    const node = lifted.create(undefined, { pluginManager })
    applyConfSettings(node, { color: 'green', rows: { domain: 'a,b' } })
    expect(getSnapshot(node)).toEqual({
      color: 'green',
      useBicolor: false,
      rows: { domain: ['a', 'b'] },
    })
  })

  test('a write that throws costs its key alone, at any depth', () => {
    const { configuration } = model()
    const report = applyConfSettings(configuration, {
      height: 'tall',
      scales: { y: { bogus: 1 } },
      facet: 'strand',
    })
    expect(report.applied).toEqual(['facet'])
    expect(report.failed.map(f => f.key)).toEqual(['height', 'scales'])
    expect(report.failed[1]!.error).toContain('no config slot "bogus"')
  })
})
