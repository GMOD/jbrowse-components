import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { getConfSnapshot, readConfObject, readConfigValue } from './util.ts'

function createPluginManager() {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return pm
}

const pm = createPluginManager()

const TestSchema = ConfigurationSchema('TestDisplay', {
  color1: {
    type: 'color',
    defaultValue: 'goldenrod',
    contextVariable: ['feature'],
  },
  featureHeight: {
    type: 'number',
    defaultValue: 10,
  },
  displayMode: {
    type: 'string',
    defaultValue: 'normal',
  },
  transcriptTypes: {
    type: 'stringArray',
    defaultValue: ['mRNA', 'transcript'],
  },
  labels: ConfigurationSchema('TestLabels', {
    fontSize: {
      type: 'number',
      defaultValue: 12,
    },
    name: {
      type: 'string',
      defaultValue: "jexl:get(feature,'name')",
      contextVariable: ['feature'],
    },
  }),
})

describe('getConfSnapshot', () => {
  it('includes default values (unlike getSnapshot)', () => {
    const config = TestSchema.create(
      { type: 'TestDisplay' },
      { pluginManager: pm },
    )

    const snap = getConfSnapshot(config)

    expect(snap.color1).toBe('goldenrod')
    expect(snap.featureHeight).toBe(10)
    expect(snap.displayMode).toBe('normal')
    expect(snap.transcriptTypes).toEqual(['mRNA', 'transcript'])
  })

  it('getSnapshot strips defaults but getConfSnapshot does not', () => {
    const config = TestSchema.create(
      { type: 'TestDisplay' },
      { pluginManager: pm },
    )

    const mstSnap = readConfObject(config)
    const fullSnap = getConfSnapshot(config)

    // readConfObject with no path uses getSnapshot which strips defaults
    expect(mstSnap.color1).toBeUndefined()
    expect(mstSnap.featureHeight).toBeUndefined()

    // getConfSnapshot preserves them
    expect(fullSnap.color1).toBe('goldenrod')
    expect(fullSnap.featureHeight).toBe(10)
  })

  it('includes custom values', () => {
    const config = TestSchema.create(
      { type: 'TestDisplay', color1: 'red', featureHeight: 20 },
      { pluginManager: pm },
    )

    const snap = getConfSnapshot(config)
    expect(snap.color1).toBe('red')
    expect(snap.featureHeight).toBe(20)
  })

  it('preserves JEXL callback strings', () => {
    const jexl = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = TestSchema.create(
      { type: 'TestDisplay', color1: jexl },
      { pluginManager: pm },
    )

    const snap = getConfSnapshot(config)
    expect(snap.color1).toBe(jexl)
  })

  it('includes nested sub-config with defaults', () => {
    const config = TestSchema.create(
      { type: 'TestDisplay' },
      { pluginManager: pm },
    )

    const snap = getConfSnapshot(config)
    expect(snap.labels).toBeDefined()
    expect((snap.labels as Record<string, unknown>).fontSize).toBe(12)
  })

  it('nested JEXL defaults are preserved', () => {
    const config = TestSchema.create(
      { type: 'TestDisplay' },
      { pluginManager: pm },
    )

    const snap = getConfSnapshot(config)
    const labels = snap.labels as Record<string, unknown>
    expect(labels.name).toBe("jexl:get(feature,'name')")
  })
})

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

const anyFeature = mockFeature()

describe('readConfigValue', () => {
  it('returns value when present', () => {
    expect(readConfigValue({ color1: 'red' }, 'color1', anyFeature)).toBe('red')
  })

  it('returns undefined when key is missing', () => {
    expect(readConfigValue({}, 'color1', anyFeature)).toBeUndefined()
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = {
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'SNV' })),
    ).toBe('green')
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })

  it('resolves nested keys', () => {
    expect(
      readConfigValue(
        { labels: { fontSize: 14 } },
        ['labels', 'fontSize'],
        anyFeature,
      ),
    ).toBe(14)
  })

  it('end-to-end: getConfSnapshot + readConfigValue', () => {
    const jexl = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = TestSchema.create(
      { type: 'TestDisplay', color1: jexl },
      { pluginManager: pm },
    )
    const snap = getConfSnapshot(config)

    expect(readConfigValue(snap, 'color1', mockFeature({ type: 'SNV' }))).toBe(
      'green',
    )
    expect(snap.featureHeight).toBe(10)
  })
})
