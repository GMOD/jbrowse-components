import { layoutBox } from './box.ts'
import { getFeatureHeightPx, sortByPosition } from './glyphUtils.ts'
import { findGlyph } from './findGlyph.ts'
import { layoutProcessedTranscript } from './processed.ts'
import { layoutSegments } from './segments.ts'
import { mockDisplayConfig } from '../testUtils.ts'

import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  start: number
  end: number
  strand?: number
  subfeatures?: ReturnType<typeof mockFeature>[]
  parentFeature?: Feature
}): Feature {
  const { type, start, end, strand = 1, subfeatures = [], parentFeature } = opts
  const f = {
    get: (key: string) => {
      const map: Record<string, unknown> = {
        type,
        name: `${type}-${start}-${end}`,
        start,
        end,
        strand,
        subfeatures,
      }
      return map[key]
    },
    id: () => `${type}-${start}-${end}`,
    parent: () => parentFeature,
  }
  return f as unknown as Feature
}

describe('sortByPosition', () => {
  function makeLayout(start: number, end: number) {
    return {
      feature: mockFeature({ type: 'CDS', start, end }),
      glyphType: 'Box' as const,
      y: 0,
      height: 10,
      totalLayoutHeight: 10,
      children: [],
    } satisfies FeatureLayout
  }

  it('sorts by start position ascending', () => {
    const layouts = [
      makeLayout(300, 400),
      makeLayout(100, 200),
      makeLayout(200, 300),
    ]
    const sorted = sortByPosition(layouts)
    expect(sorted.map(l => l.feature.get('start'))).toEqual([100, 200, 300])
  })

  it('breaks ties on start by end descending (longer first)', () => {
    const layouts = [
      makeLayout(100, 200),
      makeLayout(100, 500),
      makeLayout(100, 300),
    ]
    const sorted = sortByPosition(layouts)
    expect(sorted.map(l => l.feature.get('end'))).toEqual([500, 300, 200])
  })

  it('does not mutate the input array', () => {
    const layouts = [makeLayout(300, 400), makeLayout(100, 200)]
    const original = [...layouts]
    sortByPosition(layouts)
    expect(layouts).toEqual(original)
  })
})

describe('getFeatureHeightPx', () => {
  it('returns config.featureHeight by default', () => {
    const feature = mockFeature({ type: 'exon', start: 0, end: 100 })
    expect(getFeatureHeightPx(feature, mockDisplayConfig())).toBe(10)
  })

  it('applies the compact multiplier', () => {
    const feature = mockFeature({ type: 'exon', start: 0, end: 100 })
    const config = mockDisplayConfig({ displayMode: 'compact' })
    expect(getFeatureHeightPx(feature, config)).toBe(6) // 10 * 0.6
  })

  it('applies the super-compact multiplier', () => {
    const feature = mockFeature({ type: 'exon', start: 0, end: 100 })
    const config = mockDisplayConfig({ displayMode: 'superCompact' })
    expect(getFeatureHeightPx(feature, config)).toBe(3) // 10 * 0.3
  })
})

describe('layoutBox', () => {
  it('returns the feature, height, and Box glyph type', () => {
    const feature = mockFeature({ type: 'match', start: 100, end: 300 })
    const layout = layoutBox({
      feature,
      reversed: false,
      config: mockDisplayConfig(),
    })
    expect(layout.height).toBe(10)
    expect(layout.glyphType).toBe('Box')
    expect(layout.children).toEqual([])
  })
})

describe('layoutProcessedTranscript', () => {
  it('sorts children by position', () => {
    const cds1 = mockFeature({ type: 'CDS', start: 300, end: 400 })
    const cds2 = mockFeature({ type: 'CDS', start: 100, end: 200 })
    const mrna = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 400,
      subfeatures: [cds1, cds2],
    })
    const layout = layoutProcessedTranscript({
      feature: mrna,
      reversed: false,
      config: mockDisplayConfig(),
    })
    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.feature.get('start')).toBe(300)
  })
})

describe('layoutSegments', () => {
  it('sorts children by position', () => {
    const sub1 = mockFeature({ type: 'exon', start: 500, end: 600 })
    const sub2 = mockFeature({ type: 'exon', start: 100, end: 200 })
    const feature = mockFeature({
      type: 'match',
      start: 100,
      end: 600,
      subfeatures: [sub1, sub2],
    })
    const layout = layoutSegments({
      feature,
      reversed: false,
      config: mockDisplayConfig(),
    })
    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.feature.get('start')).toBe(500)
  })
})

describe('findGlyph', () => {
  const layoutArgs = { reversed: false }

  it('auto-detects isTopLevel from feature.parent()', () => {
    const parent = mockFeature({ type: 'gene', start: 0, end: 1000 })
    const nested = mockFeature({
      type: 'region',
      start: 0,
      end: 1000,
      parentFeature: parent,
      subfeatures: [
        mockFeature({
          type: 'child',
          start: 0,
          end: 500,
          subfeatures: [
            mockFeature({ type: 'grandchild', start: 0, end: 100 }),
          ],
        }),
      ],
    })
    const config = mockDisplayConfig()
    // feature with parent → non-top-level → Segments, not Subfeatures
    expect(
      findGlyph(nested, config)({ feature: nested, config, ...layoutArgs })
        .glyphType,
    ).toBe('Segments')
  })

  it('returns Subfeatures for top-level with nested children', () => {
    const feature = mockFeature({
      type: 'gene',
      start: 0,
      end: 1000,
      subfeatures: [
        mockFeature({
          type: 'mRNA',
          start: 0,
          end: 1000,
          subfeatures: [mockFeature({ type: 'CDS', start: 0, end: 100 })],
        }),
      ],
    })
    const config = mockDisplayConfig()
    expect(
      findGlyph(feature, config)({ feature, config, ...layoutArgs }).glyphType,
    ).toBe('Subfeatures')
  })

  it('returns Box for leaf features', () => {
    const feature = mockFeature({ type: 'match', start: 0, end: 100 })
    const config = mockDisplayConfig()
    expect(
      findGlyph(feature, config)({ feature, config, ...layoutArgs }).glyphType,
    ).toBe('Box')
  })

  it('respects explicit isTopLevel=false', () => {
    const feature = mockFeature({
      type: 'region',
      start: 0,
      end: 1000,
      subfeatures: [
        mockFeature({
          type: 'child',
          start: 0,
          end: 500,
          subfeatures: [
            mockFeature({ type: 'grandchild', start: 0, end: 100 }),
          ],
        }),
      ],
    })
    const config = mockDisplayConfig()
    expect(
      findGlyph(feature, config, false)({ feature, config, ...layoutArgs })
        .glyphType,
    ).toBe('Segments')
  })
})
