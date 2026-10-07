import createJexlInstance from '@jbrowse/core/util/jexl'

import {
  getFeatureName,
  readFeatureLabels,
  reservesBelowLabelRow,
  subfeatureLabelText,
} from './labelUtils.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { GlyphType } from './types.ts'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

function createMockFeature(name: string, id = 'feat-1') {
  return {
    get: (key: string) => {
      if (key === 'name') {
        return name
      }
      if (key === 'id') {
        return id
      }
      return ''
    },
    id: () => id,
  } as any
}

function featureWith(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    id: () => 'x',
  } as any
}

describe('getFeatureName', () => {
  it('joins a multi-valued (array) name into a string', () => {
    expect(getFeatureName(featureWith({ name: ['BRCA1', 'alias2'] }))).toBe(
      'BRCA1,alias2',
    )
  })

  it('falls back to id when name is empty', () => {
    expect(getFeatureName(featureWith({ name: '', id: 'feat-9' }))).toBe(
      'feat-9',
    )
  })

  it('returns undefined when name and id are both absent', () => {
    expect(getFeatureName(featureWith({}))).toBe(undefined)
  })
})

describe('readFeatureLabels', () => {
  const feature = createMockFeature('GENE')
  const jexl = createJexlInstance()

  const labelled = (labels: { name?: string; description?: string }) =>
    mockDisplayConfig({ labels: { name: '', description: '', ...labels } })

  it('joins a multi-valued (array) description into a single string', () => {
    // RefSeq GFFs with unescaped commas in a description get parsed into an
    // array of values; the label must still be a string.
    const note = ['microRNAs are short', ' which are cleaved']
    expect(
      readFeatureLabels(
        labelled({ description: 'note' }),
        featureWith({ note }),
        jexl,
      ).description,
    ).toBe('microRNAs are short, which are cleaved')
  })

  it('reads a plain string as the field of that name', () => {
    const gene = featureWith({ gene_name: 'BRCA1', note: 'A gene' })
    expect(
      readFeatureLabels(
        labelled({ name: 'gene_name', description: 'note' }),
        gene,
        jexl,
      ),
    ).toEqual({ name: 'BRCA1', description: 'A gene' })
  })

  it('reads a dotted path into a structured field', () => {
    const variant = featureWith({ INFO: { SVTYPE: ['DEL'] } })
    expect(
      readFeatureLabels(labelled({ name: 'INFO.SVTYPE' }), variant, jexl).name,
    ).toBe('DEL')
  })

  it('draws no label for a field the feature lacks', () => {
    expect(
      readFeatureLabels(labelled({ name: 'gene_name' }), feature, jexl).name,
    ).toBe(undefined)
  })

  it('draws no label for an empty field, the off spelling', () => {
    expect(readFeatureLabels(mockDisplayConfig(), feature, jexl)).toEqual({
      name: undefined,
      description: undefined,
    })
  })

  it('draws no label for an expression that does not compile or throws', () => {
    expect(
      readFeatureLabels(
        labelled({ name: 'jexl:get(feature,', description: 'jexl:nope(1)' }),
        feature,
        jexl,
      ),
    ).toEqual({ name: undefined, description: undefined })
  })

  it('evaluates a jexl labels.name against the feature', () => {
    const config = mockDisplayConfig()
    config.labels.name = `jexl:get(feature,'name')`
    expect(readFeatureLabels(config, feature, jexl).name).toBe('GENE')
  })

  it('resolves a plugin-registered jexl function in labels.name when the instance is passed', () => {
    // The expression string is unique, so stringToJexlExpression's compilation
    // cache binds it to this instance.
    const pluginJexl = createJexlInstance()
    pluginJexl.addFunction('shoutLabelUnique', (s: string) => `${s}!`)
    const config = mockDisplayConfig()
    config.labels.name = `jexl:shoutLabelUnique(get(feature,'name'))`
    expect(readFeatureLabels(config, feature, pluginJexl).name).toBe('GENE!')
  })
})

// The row is COUNTED here, not sized: its height is the display mode's label
// font size and the worker is mode-agnostic.
describe('reservesBelowLabelRow', () => {
  const ask = (
    feature: unknown,
    subfeatureLabels: string,
    glyphType: GlyphType = 'ProcessedTranscript',
    config?: Record<string, unknown>,
    jexl?: JexlInstance,
  ) =>
    reservesBelowLabelRow({
      feature: feature as any,
      config: mockDisplayConfig({ subfeatureLabels, ...config } as any),
      glyphType,
      jexl,
    })

  // No name and no id: getFeatureName falls back to the id, so an id-bearing
  // fixture would reserve either way and hide the divergence.
  const productOnly = (product?: string) =>
    ({
      get: (key: string) => (key === 'product' ? product : undefined),
      id: () => '',
    }) as any

  const NAME_FROM_PRODUCT = {
    labels: { name: "jexl:get(feature,'product')" },
  }

  // The label that draws comes from the `labels.name` slot, so the reservation
  // has to ask the same thing.
  it('reserves off the labels.name slot, not the raw name', () => {
    const jexl = createJexlInstance()
    const feature = productOnly('nsp5')
    expect(
      ask(feature, 'below', 'ProcessedTranscript', NAME_FROM_PRODUCT, jexl),
    ).toBe(true)
    // the emitted label is that same string, which is what makes the row the
    // right size
    expect(
      subfeatureLabelText(
        feature,
        mockDisplayConfig(NAME_FROM_PRODUCT as any),
        jexl,
      ),
    ).toBe('nsp5')
  })

  // The converse, so a widened read cannot pass by reserving for everything.
  it('does not reserve when the slot resolves to nothing either', () => {
    const jexl = createJexlInstance()
    expect(
      ask(
        productOnly(undefined),
        'below',
        'ProcessedTranscript',
        NAME_FROM_PRODUCT,
        jexl,
      ),
    ).toBe(false)
  })

  it('reads a plain field with no jexl instance, as a layout test calls it', () => {
    expect(
      ask(productOnly('nsp5'), 'below', 'ProcessedTranscript', {
        labels: { name: 'product' },
      }),
    ).toBe(true)
  })

  it('reserves for a named transcript child in "below" mode', () => {
    expect(ask(createMockFeature('NM_001234'), 'below')).toBe(true)
  })

  // The gate is the glyph, not the feature's type: a `lnc_RNA` isoform lands on
  // Segments and its emitter labels it exactly like an mRNA.
  it('reserves for a non-coding isoform, which draws the same label', () => {
    expect(ask(createMockFeature('XR_001234'), 'below', 'Segments')).toBe(true)
    expect(ask(createMockFeature('some-region'), 'below', 'Box')).toBe(true)
  })

  it('falls back to the feature id when the name is empty', () => {
    expect(ask(createMockFeature('', 'transcript-fallback-id'), 'below')).toBe(
      true,
    )
  })

  it('reserves nothing when there is no text to draw', () => {
    expect(ask(createMockFeature('', ''), 'below')).toBe(false)
  })

  it('reserves nothing for overlay or none — neither costs a row', () => {
    expect(ask(createMockFeature('NM_001234'), 'overlay')).toBe(false)
    expect(ask(createMockFeature('NM_001234'), 'none')).toBe(false)
  })

  // These label their CHILDREN, never themselves, so the rows belong to the
  // child layout and counting one here too would double-spend them.
  it('reserves nothing for a glyph that labels its children instead', () => {
    expect(
      ask(createMockFeature('polyprotein'), 'below', 'MatureProteinRegion'),
    ).toBe(false)
    expect(ask(createMockFeature('LTR-1'), 'below', 'RepeatRegion')).toBe(false)
  })
})
