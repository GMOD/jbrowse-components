import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'

function createPluginManager() {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return pm
}

describe('LinearBasicDisplay configSchema', () => {
  const pm = createPluginManager()
  const schema = configSchemaFactory(pm)

  it('creates config with default values', () => {
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay' },
      { pluginManager: pm },
    )
    expect(readConfObject(config, 'color1')).toBe('goldenrod')
    expect(readConfObject(config, 'color2')).toBe('#f0f')
    expect(readConfObject(config, 'color3')).toBe('#357089')
    expect(readConfObject(config, 'featureHeight')).toBe(10)
    expect(readConfObject(config, 'displayMode')).toBe('normal')
    expect(readConfObject(config, 'geneGlyphMode')).toBe('auto')
    expect(readConfObject(config, 'transcriptTypes')).toEqual([
      'mRNA',
      'transcript',
      'primary_transcript',
    ])
  })

  it('accepts custom color values', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color1: 'red',
        color2: 'blue',
      },
      { pluginManager: pm },
    )
    expect(readConfObject(config, 'color1')).toBe('red')
    expect(readConfObject(config, 'color2')).toBe('blue')
  })

  it('accepts JEXL color expression', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
      },
      { pluginManager: pm },
    )
    // The raw value is the JEXL string
    const slot = config.color1
    expect(slot.isCallback).toBe(true)
  })

  it('readConfObject with no path returns serializable snapshot', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color1: 'red',
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)

    // Should be a plain object, not an MST node
    expect(typeof snap).toBe('object')
    // Should contain the custom value
    expect(snap.color1).toBe('red')
    // Should have display-level fields
    expect(snap.displayId).toBe('test')
    expect(snap.type).toBe('LinearBasicDisplay')

    // postProcessSnapshot strips default values, so defaults are absent
    expect(snap.transcriptTypes).toBeUndefined()
    expect(snap.labels).toBeUndefined()

    // renderer slot was removed — should not appear in snapshot
    expect(snap.renderer).toBeUndefined()
  })

  it('snapshot with JEXL preserves the raw expression string', () => {
    const jexlExpr = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color1: jexlExpr,
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.color1).toBe(jexlExpr)
  })

  it('snapshot with custom labels preserves them', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        labels: { nameColor: 'red' },
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.labels).toBeDefined()
    expect(snap.labels.nameColor).toBe('red')
  })

  it('readConfObject with specific key reads from slot correctly', () => {
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay' },
      { pluginManager: pm },
    )
    expect(readConfObject(config, 'transcriptTypes')).toEqual([
      'mRNA',
      'transcript',
      'primary_transcript',
    ])
  })

  it('JEXL callback slot exposes isCallback and raw value', () => {
    const jexlExpr = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay', color1: jexlExpr },
      { pluginManager: pm },
    )
    expect(config.color1.isCallback).toBe(true)
    expect(String(config.color1.value)).toBe(jexlExpr)
  })

  // Compat: old configs stored colour/label settings under a renderer
  // sub-config. The preProcessSnapshot lifts those props to the display level.
  describe('SvgFeatureRenderer/CanvasFeatureRenderer compat migration', () => {
    it('lifts color1 from renderer to display level', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color1')).toBe('red')
      // renderer slot was removed — snapshot should not have it
      expect('renderer' in config).toBe(false)
    })

    it('lifts labels.description from renderer', () => {
      const expr = "jexl:get(feature,'geneSymbol')"
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: {
            type: 'SvgFeatureRenderer',
            labels: { description: expr },
          },
        },
        { pluginManager: pm },
      )
      // Check raw slot value to avoid evaluating JEXL without a feature context
      expect(String(config.labels.description.value)).toBe(expr)
      expect(config.labels.description.isCallback).toBe(true)
    })

    it('display-level props take precedence over renderer props', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          color1: 'blue',
          renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color1')).toBe('blue')
    })

    it('works with CanvasFeatureRenderer type too', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'CanvasFeatureRenderer', color1: 'green' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color1')).toBe('green')
    })

    it('no-op when renderer is absent', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', color1: 'purple' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color1')).toBe('purple')
    })
  })
})
