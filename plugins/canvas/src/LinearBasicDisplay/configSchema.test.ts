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
        labels: { fontSize: 14, nameColor: 'red' },
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.labels).toBeDefined()
    expect(snap.labels.fontSize).toBe(14)
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
    expect(readConfObject(config, ['labels', 'fontSize'])).toBe(12)
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
})
