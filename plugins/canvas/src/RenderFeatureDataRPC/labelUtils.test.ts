import { applyLabelDimensions } from './labelUtils.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureLayout } from './types.ts'

function createMockLayout(height = 10): FeatureLayout {
  return {
    feature: null as any,
    glyphType: 'ProcessedTranscript',
    x: 0,
    y: 0,
    width: 100,
    height,
    totalLayoutHeight: height,
    totalLayoutWidth: 100,
    leftPadding: 0,
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

describe('applyLabelDimensions', () => {
  describe('transcript children with "below" subfeature labels', () => {
    it('increases totalLayoutHeight using feature name even when config labels.name is empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isNested: true,
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10 + 12)
    })

    it('falls back to feature id when name is empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('', 'transcript-fallback-id'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isNested: true,
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10 + 12)
    })

    it('does not change totalLayoutHeight when both name and id are empty', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('', ''),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isNested: true,
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })

    it('sets totalLayoutWidth based on label text width', () => {
      const layout = createMockLayout(10)
      layout.totalLayoutWidth = 50
      applyLabelDimensions(layout, {
        feature: createMockFeature('A_very_long_transcript_name_here'),
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
        isNested: true,
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutWidth).toBeGreaterThan(50)
    })
  })

  describe('transcript children with "overlay" subfeature labels', () => {
    it('does not add extra height', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ subfeatureLabels: 'overlay' }),
        isNested: true,
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
        isNested: true,
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
        isNested: true,
        isTranscriptChild: false,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })

  describe('collapse mode disables labels', () => {
    it('skips all label calculation', () => {
      const layout = createMockLayout(10)
      applyLabelDimensions(layout, {
        feature: createMockFeature('NM_001234'),
        config: mockDisplayConfig({ displayMode: 'collapse' }),
        isNested: true,
        isTranscriptChild: true,
      })
      expect(layout.totalLayoutHeight).toBe(10)
    })
  })
})
