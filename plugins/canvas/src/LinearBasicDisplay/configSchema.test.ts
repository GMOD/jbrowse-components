import PluginManager from '@jbrowse/core/PluginManager'
import { isCallbackValue, readConfObject } from '@jbrowse/core/configuration'

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
    expect(readConfObject(config, 'color')).toBeUndefined()
    expect(readConfObject(config, 'utrColor')).toBeUndefined()
    expect(readConfObject(config, 'connectorColor')).toBeUndefined()
    expect(readConfObject(config, 'featureHeight')).toBe(10)
    expect(readConfObject(config, 'displayMode')).toBeUndefined()
    expect(readConfObject(config, 'geneGlyphMode')).toBe('auto')
    expect(readConfObject(config, 'transcriptTypes')).toEqual([
      'mRNA',
      'transcript',
      'primary_transcript',
      'V_gene_segment',
      'C_gene_segment',
      'D_gene_segment',
      'J_gene_segment',
    ])
  })

  it('accepts custom color values', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color: 'red',
        connectorColor: 'blue',
      },
      { pluginManager: pm },
    )
    expect(readConfObject(config, 'color')).toBe('red')
    expect(readConfObject(config, 'connectorColor')).toBe('blue')
  })

  it('accepts JEXL color expression', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
      },
      { pluginManager: pm },
    )
    expect(isCallbackValue(config.color)).toBe(true)
  })

  it('readConfObject with no path returns serializable snapshot', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color: 'red',
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)

    expect(typeof snap).toBe('object')
    expect(snap.color).toBe('red')
    expect(snap.displayId).toBe('test')
    expect(snap.type).toBe('LinearBasicDisplay')

    expect(snap.transcriptTypes).toBeUndefined()
    expect(snap.labels).toBeUndefined()

    expect(snap.renderer).toBeUndefined()
  })

  it('snapshot with JEXL preserves the raw expression string', () => {
    const jexlExpr = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        color: jexlExpr,
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.color).toBe(jexlExpr)
  })

  it('snapshot with custom labels preserves them', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        labels: { name: "jexl:get(feature,'gene_name')" },
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.labels).toBeDefined()
    expect(snap.labels.name).toBe("jexl:get(feature,'gene_name')")
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
      'V_gene_segment',
      'C_gene_segment',
      'D_gene_segment',
      'J_gene_segment',
    ])
  })

  it('JEXL callback slot exposes isCallback and raw value', () => {
    const jexlExpr = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay', color: jexlExpr },
      { pluginManager: pm },
    )
    expect(isCallbackValue(config.color)).toBe(true)
    expect(config.color).toBe(jexlExpr)
  })

  describe('SvgFeatureRenderer/CanvasFeatureRenderer compat migration', () => {
    it('lifts color1 from renderer to display level as color', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color')).toBe('red')
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
      expect(config.labels.description).toBe(expr)
      expect(isCallbackValue(config.labels.description)).toBe(true)
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
      expect(readConfObject(config, 'color')).toBe('blue')
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
      expect(readConfObject(config, 'color')).toBe('green')
    })

    it('no-op when renderer is absent', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', color1: 'purple' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color')).toBe('purple')
    })

    it('converts boolean showLabels lifted from renderer to enum', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'CanvasFeatureRenderer', showLabels: true },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe('auto')
    })

    it('converts boolean showLabels=false to the description rung', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          showLabels: false,
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe('description')
    })

    it.each([
      [{ showLabels: 'on' }, 'nameAndDescription'],
      [{ showLabels: 'on', showDescriptions: false }, 'name'],
      [{ showLabels: 'off' }, 'description'],
      [{ showLabels: 'off', showDescriptions: false }, 'none'],
      [{ showLabels: false, showDescriptions: false }, 'none'],
      [{ showLabels: 'auto', showDescriptions: false }, 'auto'],
    ])('folds the legacy %s pair onto the unified enum', (legacy, expected) => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', ...legacy },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe(expected)
    })

    it('leaves a unified-enum showLabels untouched', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          showLabels: 'description',
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe('description')
    })

    it.each([
      [{ showLabels: 'none', showDescriptions: false }, 'none'],
      [{ showLabels: 'name', showDescriptions: true }, 'name'],
      [{ showDescriptions: false }, 'auto'],
    ])(
      'keeps a unified-enum showLabels beside a stale showDescriptions %j',
      (legacy, expected) => {
        const config = schema.create(
          { displayId: 'test', type: 'LinearBasicDisplay', ...legacy },
          { pluginManager: pm },
        )
        expect(readConfObject(config, 'showLabels')).toBe(expected)
      },
    )

    it('maps legacy geneGlyphMode "longest" lifted from renderer to "longestCoding"', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'CanvasFeatureRenderer', geneGlyphMode: 'longest' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'geneGlyphMode')).toBe('longestCoding')
    })

    it('leaves valid geneGlyphMode untouched', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', geneGlyphMode: 'all' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'geneGlyphMode')).toBe('all')
    })
  })

  describe('legacy color1/color2/color3 names', () => {
    it('maps color1/color2/color3/outline onto the new names', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          color1: 'blue',
          color2: 'gray',
          color3: 'lightblue',
          outline: 'black',
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color')).toBe('blue')
      expect(readConfObject(config, 'connectorColor')).toBe('gray')
      expect(readConfObject(config, 'utrColor')).toBe('lightblue')
      expect(readConfObject(config, 'outlineColor')).toBe('black')
    })

    it('maps a legacy jexl color1 expression onto color', () => {
      const expr = "jexl:get(feature,'type')=='gene'?'blue':'gray'"
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', color1: expr },
        { pluginManager: pm },
      )
      expect(config.color).toBe(expr)
      expect(isCallbackValue(config.color)).toBe(true)
    })

    it('the new color name wins over a legacy color1', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          color: 'red',
          color1: 'blue',
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'color')).toBe('red')
    })
  })
})
