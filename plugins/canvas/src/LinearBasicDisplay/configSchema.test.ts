import PluginManager from '@jbrowse/core/PluginManager'
import { isCallbackValue, readConfObject } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

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
    expect(
      readConfObject(config, ['encoding', 'color', 'value']),
    ).toBeUndefined()
    expect(
      readConfObject(config, ['utrs', 'encoding', 'color', 'value']),
    ).toBeUndefined()
    expect(readConfObject(config, ['mark', 'height'])).toBe(10)
    expect(readConfObject(config, 'displayMode')).toBe('normal')
    expect(readConfObject(config, 'geneGlyphMode')).toBe('auto')
    expect(readConfObject(config, ['transcripts', 'types'])).toEqual([
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
        encoding: { color: { value: 'red' } },
      },
      { pluginManager: pm },
    )
    expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe('red')
  })

  it('accepts JEXL color expression', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        encoding: {
          color: { value: "jexl:get(feature,'type')=='SNV'?'green':'purple'" },
        },
      },
      { pluginManager: pm },
    )
    expect(isCallbackValue(config.encoding.color.value)).toBe(true)
  })

  it('readConfObject with no path returns serializable snapshot', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        encoding: { color: { value: 'red' } },
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)

    expect(typeof snap).toBe('object')
    expect(snap.encoding.color.value).toBe('red')
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
        encoding: { color: { value: jexlExpr } },
      },
      { pluginManager: pm },
    )
    const snap = readConfObject(config)
    expect(snap.encoding.color.value).toBe(jexlExpr)
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
    expect(snap.labels.name.field).toBe("jexl:get(feature,'gene_name')")
  })

  it('readConfObject with specific key reads from slot correctly', () => {
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay' },
      { pluginManager: pm },
    )
    expect(readConfObject(config, ['transcripts', 'types'])).toEqual([
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
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        encoding: { color: { value: jexlExpr } },
      },
      { pluginManager: pm },
    )
    expect(isCallbackValue(config.encoding.color.value)).toBe(true)
    expect(config.encoding.color.value).toBe(jexlExpr)
  })

  describe('SvgFeatureRenderer/CanvasFeatureRenderer compat migration', () => {
    it('lifts color1 from renderer to display level as encoding.color', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe('red')
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
      expect(config.labels.description.field).toBe(expr)
      expect(isCallbackValue(config.labels.description.field)).toBe(true)
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
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe(
        'blue',
      )
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
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe(
        'green',
      )
    })

    it('no-op when renderer is absent', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', color1: 'purple' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe(
        'purple',
      )
    })

    const shown = (config: ReturnType<typeof schema.create>) => [
      readConfObject(config, ['labels', 'name', 'show']),
      readConfObject(config, ['labels', 'description', 'show']),
    ]

    it.each([
      [{ showLabels: true }, [true, true]],
      [{ showLabels: true, showDescriptions: false }, [true, false]],
      [{ showLabels: false }, [false, true]],
      [{ showLabels: false, showDescriptions: false }, [false, false]],
      [{ showDescriptions: false }, [true, false]],
      [{ showLabels: 'auto' }, [true, true]],
      [{ showLabels: 'nameAndDescription' }, [true, true]],
      [{ showLabels: 'name' }, [true, false]],
      [{ showLabels: 'description' }, [false, true]],
      [{ showLabels: 'none' }, [false, false]],
      [
        { renderer: { type: 'CanvasFeatureRenderer', showLabels: false } },
        [false, true],
      ],
      [
        {
          showLabels: true,
          renderer: { type: 'CanvasFeatureRenderer', showLabels: false },
        },
        [true, true],
      ],
    ])('lifts the legacy %j onto the label parts', (legacy, expected) => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', ...legacy },
        { pluginManager: pm },
      )
      expect(shown(config)).toEqual(expected)
    })

    // jb2hubs writes `labels.name` as a bare string; the hide beside it must
    // land next to the field rather than under the string
    it.each([
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        labels: { name: 'gene_name' },
        showLabels: 'none',
      },
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        renderer: {
          type: 'SvgFeatureRenderer',
          labels: { name: 'gene_name' },
          showLabels: 'none',
        },
      },
    ])('keeps a hide beside a label field written bare (%#)', snapshot => {
      const config = schema.create(snapshot, { pluginManager: pm })
      expect(shown(config)).toEqual([false, false])
      expect(readConfObject(config, ['labels', 'name', 'field'])).toBe(
        'gene_name',
      )
    })

    it.each([
      [{ subfeatureLabels: 'none' }, [false, 'auto']],
      [{ subfeatureLabels: 'below' }, [true, 'below']],
      [
        {
          renderer: {
            type: 'CanvasFeatureRenderer',
            subfeatureLabels: 'overlay',
          },
        },
        [true, 'overlay'],
      ],
    ])('lifts the v4 %j onto labels.subfeatures', (legacy, expected) => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', ...legacy },
        { pluginManager: pm },
      )
      expect([
        readConfObject(config, ['labels', 'subfeatures', 'show']),
        readConfObject(config, ['labels', 'subfeatures', 'placement']),
      ]).toEqual(expected)
    })

    it('maps legacy geneGlyphMode "longest" lifted from renderer to "representative"', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          renderer: { type: 'CanvasFeatureRenderer', geneGlyphMode: 'longest' },
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'geneGlyphMode')).toBe('representative')
    })

    it('maps v4.3.0 geneGlyphMode "longestCoding" to "representative"', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'geneGlyphMode')).toBe('representative')
    })

    it('leaves valid geneGlyphMode untouched', () => {
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', geneGlyphMode: 'all' },
        { pluginManager: pm },
      )
      expect(readConfObject(config, 'geneGlyphMode')).toBe('all')
    })
  })

  it('lifts the flat gene-structure names into transcripts and containers', () => {
    const config = schema.create(
      {
        displayId: 'test',
        type: 'LinearBasicDisplay',
        transcriptTypes: ['mRNA'],
        canonicalTranscriptField: 'flag',
        canonicalTranscriptTags: ['yes'],
        containerTypes: ['orf'],
      },
      { pluginManager: pm },
    )
    expect(getSnapshot(config.transcripts)).toEqual({
      types: ['mRNA'],
      field: 'flag',
      sort: ['yes'],
    })
    expect(readConfObject(config, ['containers', 'types'])).toEqual(['orf'])
  })

  describe('legacy color1/color2/color3 names', () => {
    it('maps color1 and color3 onto the new names, dropping color2 and outline', () => {
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
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe(
        'blue',
      )
      expect(
        readConfObject(config, ['utrs', 'encoding', 'color', 'value']),
      ).toBe('lightblue')
      expect(getSnapshot(config)).not.toHaveProperty('color2')
    })

    it('maps a legacy jexl color1 expression onto encoding.color', () => {
      const expr = "jexl:get(feature,'type')=='gene'?'blue':'gray'"
      const config = schema.create(
        { displayId: 'test', type: 'LinearBasicDisplay', color1: expr },
        { pluginManager: pm },
      )
      expect(config.encoding.color.value).toBe(expr)
      expect(isCallbackValue(config.encoding.color.value)).toBe(true)
    })

    it('the new color name wins over a legacy color1', () => {
      const config = schema.create(
        {
          displayId: 'test',
          type: 'LinearBasicDisplay',
          encoding: { color: { value: 'red' } },
          color1: 'blue',
        },
        { pluginManager: pm },
      )
      expect(readConfObject(config, ['encoding', 'color', 'value'])).toBe('red')
    })
  })
})

test('mouseover lifts to tooltip.field on the feature display, and away on the shared base', () => {
  const pm = createPluginManager()
  const basic = configSchemaFactory(pm).create(
    {
      displayId: 'b',
      type: 'LinearBasicDisplay',
      mouseover: "jexl:get(feature,'product')",
    },
    { pluginManager: pm },
  )
  expect(readConfObject(basic, ['tooltip', 'field'])).toBe(
    "jexl:get(feature,'product')",
  )
  const base = baseLinearDisplayConfigSchema.create(
    { displayId: 'a', mouseover: 'hover text' },
    { pluginManager: pm },
  )
  expect(getSnapshot(base)).not.toHaveProperty('mouseover')
})
