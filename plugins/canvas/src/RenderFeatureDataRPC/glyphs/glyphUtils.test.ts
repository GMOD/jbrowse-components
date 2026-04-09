import { boxGlyph } from './box.ts'
import {
  getFeatureDimensions,
  getStrandArrowPadding,
  layoutChild,
  layoutContainerGlyph,
  sortByPosition,
} from './glyphUtils.ts'
import { findGlyph } from './index.ts'
import { processedTranscriptGlyph } from './processed.ts'
import { segmentsGlyph } from './segments.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function createMockConfigContext(
  overrides: Partial<RenderConfigContext> = {},
): RenderConfigContext {
  return {
    config: {
      featureHeight: 10,
      labels: { name: '', description: '', fontSize: 12 },
      subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    } as any,
    displayMode: 'normal',
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    containerTypes: [],
    geneGlyphMode: 'all',
    displayDirectionalChevrons: true,
    labelAllowed: true,
    heightMultiplier: 1,
    ...overrides,
  }
}

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
      x: 0,
      y: 0,
      width: end - start,
      height: 10,
      totalLayoutHeight: 10,
      totalLayoutWidth: end - start,
      leftPadding: 0,
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
    expect(layouts[0]).toBe(original[0])
    expect(layouts[1]).toBe(original[1])
  })

  it('returns empty array for empty input', () => {
    expect(sortByPosition([])).toEqual([])
  })
})

describe('getStrandArrowPadding', () => {
  it('returns left padding for reverse strand', () => {
    const pad = getStrandArrowPadding(-1)
    expect(pad.left).toBeGreaterThan(0)
    expect(pad.right).toBe(0)
    expect(pad.visualSide).toBe('left')
  })

  it('returns right padding for forward strand', () => {
    const pad = getStrandArrowPadding(1)
    expect(pad.left).toBe(0)
    expect(pad.right).toBeGreaterThan(0)
    expect(pad.visualSide).toBe('right')
  })

  it('returns no padding for unstranded', () => {
    const pad = getStrandArrowPadding(0)
    expect(pad.left).toBe(0)
    expect(pad.right).toBe(0)
    expect(pad.visualSide).toBeNull()
    expect(pad.width).toBe(0)
  })
})

describe('getFeatureDimensions', () => {
  it('computes height with multiplier and width from bp range', () => {
    const feature = mockFeature({ type: 'exon', start: 100, end: 300 })
    const configContext = createMockConfigContext({ heightMultiplier: 0.6 })

    const dims = getFeatureDimensions(feature, 1, configContext)

    expect(dims.start).toBe(100)
    expect(dims.end).toBe(300)
    expect(dims.widthPx).toBe(200)
    expect(dims.heightPx).toBe(6) // 10 * 0.6
  })

  it('scales width by bpPerPx', () => {
    const feature = mockFeature({ type: 'exon', start: 0, end: 1000 })
    const configContext = createMockConfigContext()

    const dims = getFeatureDimensions(feature, 10, configContext)

    expect(dims.widthPx).toBe(100)
  })
})

describe('layoutChild', () => {
  it('computes x offset relative to parent start', () => {
    const parent = mockFeature({ type: 'mRNA', start: 100, end: 500 })
    const child = mockFeature({
      type: 'CDS',
      start: 200,
      end: 300,
      parentFeature: parent,
    })
    const configContext = createMockConfigContext()

    const result = layoutChild(child, parent, {
      feature: parent,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(result.x).toBe(100)
    expect(result.width).toBe(100)
    expect(result.leftPadding).toBe(0)
  })

  it('scales by bpPerPx', () => {
    const parent = mockFeature({ type: 'mRNA', start: 100, end: 500 })
    const child = mockFeature({
      type: 'CDS',
      start: 200,
      end: 400,
      parentFeature: parent,
    })
    const configContext = createMockConfigContext()

    const result = layoutChild(child, parent, {
      feature: parent,
      bpPerPx: 2,
      reversed: false,
      configContext,
    })

    expect(result.x).toBe(50)
    expect(result.width).toBe(100)
  })
})

describe('boxGlyph', () => {
  it('uses Px-suffixed naming convention (layout returns correct dimensions)', () => {
    const feature = mockFeature({
      type: 'match',
      start: 100,
      end: 300,
      strand: 1,
    })
    const configContext = createMockConfigContext()

    const layout = boxGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.width).toBe(200)
    expect(layout.height).toBe(10)
    expect(layout.glyphType).toBe('Box')
  })

  it('adds arrow padding for top-level forward strand features', () => {
    const feature = mockFeature({
      type: 'match',
      start: 100,
      end: 300,
      strand: 1,
    })
    const configContext = createMockConfigContext()

    const layout = boxGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.leftPadding).toBe(0)
    expect(layout.totalLayoutWidth).toBeGreaterThan(layout.width)
  })

  it('skips arrow padding for child features', () => {
    const parent = mockFeature({ type: 'gene', start: 100, end: 500 })
    const child = mockFeature({
      type: 'exon',
      start: 100,
      end: 300,
      strand: 1,
      parentFeature: parent,
    })
    const configContext = createMockConfigContext()

    const layout = boxGlyph.layout({
      feature: child,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.leftPadding).toBe(0)
    expect(layout.totalLayoutWidth).toBe(layout.width)
  })
})

describe('boxGlyph for CDS', () => {
  it('adds arrow padding for top-level CDS (same as any top-level feature)', () => {
    const feature = mockFeature({
      type: 'CDS',
      start: 200,
      end: 400,
      strand: 1,
    })
    const configContext = createMockConfigContext()

    const layout = boxGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.width).toBe(200)
    expect(layout.height).toBe(10)
    expect(layout.glyphType).toBe('Box')
    expect(layout.totalLayoutWidth).toBeGreaterThan(layout.width)
  })

  it('skips arrow padding for child CDS', () => {
    const parent = mockFeature({ type: 'mRNA', start: 100, end: 500 })
    const feature = mockFeature({
      type: 'CDS',
      start: 200,
      end: 400,
      strand: 1,
      parentFeature: parent,
    })
    const configContext = createMockConfigContext()

    const layout = boxGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.leftPadding).toBe(0)
    expect(layout.totalLayoutWidth).toBe(layout.width)
  })
})

describe('processedTranscriptGlyph', () => {
  it('sorts children by position', () => {
    const cds1 = mockFeature({ type: 'CDS', start: 300, end: 400 })
    const cds2 = mockFeature({ type: 'CDS', start: 100, end: 200 })
    const mrna = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 400,
      strand: 1,
      subfeatures: [cds1, cds2],
    })
    const configContext = createMockConfigContext()

    const layout = processedTranscriptGlyph.layout({
      feature: mrna,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.feature.get('start')).toBe(300)
  })
})

describe('segmentsGlyph', () => {
  it('sorts children by position', () => {
    const sub1 = mockFeature({ type: 'exon', start: 500, end: 600 })
    const sub2 = mockFeature({ type: 'exon', start: 100, end: 200 })
    const feature = mockFeature({
      type: 'match',
      start: 100,
      end: 600,
      strand: -1,
      subfeatures: [sub1, sub2],
    })
    const configContext = createMockConfigContext()

    const layout = segmentsGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.feature.get('start')).toBe(500)
    expect(layout.leftPadding).toBeGreaterThan(0)
  })
})

describe('segmentsGlyph for repeat_region', () => {
  it('repeat_region uses segments glyph and sorts children', () => {
    const sub1 = mockFeature({ type: 'repeat_unit', start: 200, end: 250 })
    const sub2 = mockFeature({ type: 'repeat_unit', start: 100, end: 150 })
    const feature = mockFeature({
      type: 'repeat_region',
      start: 100,
      end: 300,
      strand: 0,
      subfeatures: [sub1, sub2],
    })
    const configContext = createMockConfigContext()

    const layout = segmentsGlyph.layout({
      feature,
      bpPerPx: 1,
      reversed: false,
      configContext,
    })

    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.feature.get('start')).toBe(200)
    expect(layout.glyphType).toBe('Segments')
    expect(layout.leftPadding).toBe(0)
  })
})

describe('layoutContainerGlyph', () => {
  it('sorts children and adds strand arrow padding', () => {
    const sub1 = mockFeature({ type: 'exon', start: 300, end: 400 })
    const sub2 = mockFeature({ type: 'CDS', start: 100, end: 200 })
    const feature = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 400,
      strand: 1,
    })
    const configContext = createMockConfigContext()
    const args = { feature, bpPerPx: 1, reversed: false, configContext }

    const layout = layoutContainerGlyph('Segments', args, [sub1, sub2])

    expect(layout.children).toHaveLength(2)
    expect(layout.children[0]!.glyphType).toBe('Box')
    expect(layout.children[0]!.feature.get('start')).toBe(100)
    expect(layout.children[1]!.glyphType).toBe('Box')
    expect(layout.children[1]!.feature.get('start')).toBe(300)
    expect(layout.totalLayoutWidth).toBeGreaterThan(layout.width)
  })
})

describe('findGlyph', () => {
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
    const configContext = createMockConfigContext()

    // feature with parent → non-top-level → Segments, not Subfeatures
    expect(findGlyph(nested, configContext).type).toBe('Segments')
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
    const configContext = createMockConfigContext()

    expect(findGlyph(feature, configContext).type).toBe('Subfeatures')
  })

  it('returns Box for leaf features', () => {
    const feature = mockFeature({ type: 'match', start: 0, end: 100 })
    const configContext = createMockConfigContext()

    expect(findGlyph(feature, configContext).type).toBe('Box')
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
    const configContext = createMockConfigContext()

    // explicit false → Segments even though feature has no parent
    expect(findGlyph(feature, configContext, false).type).toBe('Segments')
  })
})
