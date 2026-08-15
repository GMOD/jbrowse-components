import createJexlInstance from '@jbrowse/core/util/jexl'

import {
  getFeatureName,
  readFeatureLabels,
  reservesBelowLabelRow,
} from './labelUtils.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { GlyphType } from './types.ts'

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

describe('getFeatureName', () => {
  function featureWith(values: Record<string, unknown>) {
    return {
      get: (key: string) => values[key],
      id: () => 'x',
    } as any
  }

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

  it('joins a multi-valued (array) description into a single string', () => {
    // RefSeq GFFs with unescaped commas in a description get parsed into an
    // array of values; the label must still be a string.
    const config = mockDisplayConfig()
    config.labels.description = [
      'microRNAs are short',
      ' which are cleaved',
    ] as unknown as string
    const { description } = readFeatureLabels(config, feature, jexl)
    expect(description).toBe('microRNAs are short, which are cleaved')
  })

  it('passes a plain string description through', () => {
    const config = mockDisplayConfig()
    config.labels.description = 'A gene'
    expect(readFeatureLabels(config, feature, jexl).description).toBe('A gene')
  })

  it('returns undefined for an empty description', () => {
    expect(
      readFeatureLabels(mockDisplayConfig(), feature, jexl).description,
    ).toBe(undefined)
  })

  it('evaluates a jexl labels.name against the feature', () => {
    const config = mockDisplayConfig()
    config.labels.name = `jexl:get(feature,'name')`
    expect(readFeatureLabels(config, feature, jexl).name).toBe('GENE')
  })

  it('resolves a plugin-registered jexl function in labels.name when the instance is passed', () => {
    // labels.name defaults ARE jexl, so a plugin-registered function only
    // resolves when the worker pluginManager's jexl instance is threaded in
    // (same contract as the mouseover slot). The expression string is unique so
    // stringToJexlExpression's compilation cache binds it to this instance.
    const pluginJexl = createJexlInstance()
    pluginJexl.addFunction('shoutLabelUnique', (s: string) => `${s}!`)
    const config = mockDisplayConfig()
    config.labels.name = `jexl:shoutLabelUnique(get(feature,'name'))`
    expect(readFeatureLabels(config, feature, pluginJexl).name).toBe('GENE!')
  })
})

// The row is COUNTED here, not sized: its height is the display mode's label
// font size and the worker is mode-agnostic. layoutSubfeatures turns each `true`
// into one `labelRowsAbove` step, which the main thread spends at labelFontPx.
describe('reservesBelowLabelRow', () => {
  const ask = (
    feature: unknown,
    subfeatureLabels: string,
    glyphType: GlyphType = 'ProcessedTranscript',
  ) =>
    reservesBelowLabelRow({
      feature: feature as any,
      config: mockDisplayConfig({ subfeatureLabels } as any),
      glyphType,
    })

  it('reserves for a named transcript child in "below" mode', () => {
    expect(ask(createMockFeature('NM_001234'), 'below')).toBe(true)
  })

  // The gate is the glyph, not the feature's type: a `lnc_RNA` isoform lands on
  // Segments and its emitter labels it exactly like an mRNA, so it costs a row
  // exactly like one. Keyed off `transcriptTypes` (which lists neither) the
  // label drew with nothing reserved and lay across the transcript beneath.
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

  // These label their CHILDREN, never themselves (a polyprotein's cleavage
  // products, a transposon's subparts), so the rows belong to the child layout
  // and counting one here too would double-spend them.
  it('reserves nothing for a glyph that labels its children instead', () => {
    expect(
      ask(createMockFeature('polyprotein'), 'below', 'MatureProteinRegion'),
    ).toBe(false)
    expect(ask(createMockFeature('LTR-1'), 'below', 'RepeatRegion')).toBe(false)
  })
})
