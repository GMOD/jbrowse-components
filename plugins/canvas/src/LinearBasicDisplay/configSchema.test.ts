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
    // color/utrColor/connectorColor are `maybeColor`: unset by default, which is
    // what lets a feature's own BED color paint (and the theme drive the
    // connector). The concrete fallbacks live in featureColors.ts and
    // getStrokeColor, not in the slot.
    expect(readConfObject(config, 'color')).toBeUndefined()
    expect(readConfObject(config, 'utrColor')).toBeUndefined()
    expect(readConfObject(config, 'connectorColor')).toBeUndefined()
    expect(readConfObject(config, 'featureHeight')).toBe(10)
    // raw slot default is the promotable `inherit` sentinel; the resolved
    // display getter turns it into `normal` (see promotableDefaults.ts)
    expect(readConfObject(config, 'displayMode')).toBe('inherit')
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
    // The raw value is the JEXL string
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

    // Should be a plain object, not an MST node
    expect(typeof snap).toBe('object')
    // Should contain the custom value
    expect(snap.color).toBe('red')
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

  // Compat: old configs stored colour/label settings under a renderer
  // sub-config, using the legacy color1 name. The preProcessSnapshot lifts
  // those props to the display level and renames color1 -> color.
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

    it('converts boolean showLabels=false to off', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          showLabels: false,
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe('off')
    })

    it('leaves enum showLabels untouched', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', showLabels: 'on' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'showLabels')).toBe('on')
    })

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

  // color1/color2/color3 were renamed to the self-describing
  // color/connectorColor/utrColor; old configs using the legacy names still
  // load by mapping onto the new slots.
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
