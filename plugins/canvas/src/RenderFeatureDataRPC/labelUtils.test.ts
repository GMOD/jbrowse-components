import createJexlInstance from '@jbrowse/core/util/jexl'

import { LABEL_FONT_SIZE } from './constants.ts'
import {
  applyLabelDimensions,
  getFeatureName,
  readFeatureLabels,
} from './labelUtils.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureLayout } from './types.ts'

function createMockLayout(height = 10): FeatureLayout {
  return {
    feature: null as any,
    glyphType: 'ProcessedTranscript',
    y: 0,
    height,
    totalLayoutHeight: height,
    children: [],
  }
}

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

  it('joins a multi-valued (array) description into a single string', () => {
    // RefSeq GFFs with unescaped commas in a description get parsed into an
    // array of values; the label must still be a string.
    const config = mockDisplayConfig()
    config.labels.description = [
      'microRNAs are short',
      ' which are cleaved',
    ] as unknown as string
    const { description } = readFeatureLabels(config, feature)
    expect(description).toBe('microRNAs are short, which are cleaved')
  })

  it('passes a plain string description through', () => {
    const config = mockDisplayConfig()
    config.labels.description = 'A gene'
    expect(readFeatureLabels(config, feature).description).toBe('A gene')
  })

  it('returns undefined for an empty description', () => {
    expect(readFeatureLabels(mockDisplayConfig(), feature).description).toBe(
      undefined,
    )
  })

  it('evaluates a jexl labels.name against the feature', () => {
    const config = mockDisplayConfig()
    config.labels.name = `jexl:get(feature,'name')`
    expect(readFeatureLabels(config, feature).name).toBe('GENE')
  })

  it('resolves a plugin-registered jexl function in labels.name when the instance is passed', () => {
    // labels.name defaults ARE jexl, so a plugin-registered function only
    // resolves when the worker pluginManager's jexl instance is threaded in
    // (same contract as the mouseover slot). The expression string is unique so
    // stringToJexlExpression's compilation cache binds it to this instance.
    const jexl = createJexlInstance()
    jexl.addFunction('shoutLabelUnique', (s: string) => `${s}!`)
    const config = mockDisplayConfig()
    config.labels.name = `jexl:shoutLabelUnique(get(feature,'name'))`
    expect(readFeatureLabels(config, feature, jexl).name).toBe('GENE!')
  })
})

describe('applyLabelDimensions', () => {
  describe('transcript children with "below" subfeature labels', () => {
    it('increases totalLayoutHeight using feature name even when config labels.name is empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10 + LABEL_FONT_SIZE)
    })

    it('falls back to feature id when name is empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('', 'transcript-fallback-id'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10 + LABEL_FONT_SIZE)
    })

    it('does not change totalLayoutHeight when both name and id are empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('', ''),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })

  describe('transcript children with "overlay" subfeature labels', () => {
    it('does not add extra height', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ subfeatureLabels: 'overlay' }),
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })

  describe('transcript children with "none" subfeature labels', () => {
    it('skips calculation entirely', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ subfeatureLabels: 'none' }),
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })

  describe('non-transcript nested children', () => {
    it('skips calculation for nested non-transcript children', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('exon-1'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isTranscriptChild: false,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })
})
