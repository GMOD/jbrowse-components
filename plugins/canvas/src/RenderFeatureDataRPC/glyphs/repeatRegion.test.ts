import { mockDisplayConfig } from '../testUtils.ts'
import { findGlyph } from './findGlyph.ts'
import { isRepeatRegion, layoutRepeatRegion } from './repeatRegion.ts'

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

// An EDTA-style intact LTR retrotransposon: a repeat_region parent whose parts
// overlap (the internal element spans the whole thing, the two LTRs sit at the
// ends, the two TSDs flank it).
function intactLtrRetrotransposon() {
  return mockFeature({
    type: 'repeat_region',
    start: 100,
    end: 1100,
    subfeatures: [
      mockFeature({ type: 'target_site_duplication', start: 100, end: 105 }),
      mockFeature({ type: 'long_terminal_repeat', start: 105, end: 305 }),
      mockFeature({ type: 'Copia_LTR_retrotransposon', start: 105, end: 1095 }),
      mockFeature({ type: 'long_terminal_repeat', start: 895, end: 1095 }),
      mockFeature({ type: 'target_site_duplication', start: 1095, end: 1100 }),
    ],
  })
}

describe('isRepeatRegion', () => {
  it('detects a repeat_region with subfeatures', () => {
    expect(isRepeatRegion(intactLtrRetrotransposon())).toBe(true)
  })

  it('is false for a repeat_region with no subfeatures', () => {
    expect(
      isRepeatRegion(mockFeature({ type: 'repeat_region', start: 1, end: 9 })),
    ).toBe(false)
  })

  it('is false for a non-repeat_region container', () => {
    expect(
      isRepeatRegion(
        mockFeature({
          type: 'gene',
          start: 1,
          end: 9,
          subfeatures: [mockFeature({ type: 'exon', start: 1, end: 9 })],
        }),
      ),
    ).toBe(false)
  })
})

describe('findGlyph routing for repeat_region', () => {
  const config = mockDisplayConfig()

  it('routes an intact repeat_region to RepeatRegion', () => {
    const feature = intactLtrRetrotransposon()
    expect(findGlyph(feature, config)({ feature, config }).glyphType).toBe(
      'RepeatRegion',
    )
  })

  it('routes a childless repeat_region to Box', () => {
    const feature = mockFeature({ type: 'repeat_region', start: 1, end: 9 })
    expect(findGlyph(feature, config)({ feature, config }).glyphType).toBe(
      'Box',
    )
  })
})

describe('layoutRepeatRegion', () => {
  it('lays subparts out on a single row (no per-part vertical offset)', () => {
    const feature = intactLtrRetrotransposon()
    const layout = layoutRepeatRegion({ feature, config: mockDisplayConfig() })

    expect(layout.glyphType).toBe('RepeatRegion')
    expect(layout.children).toHaveLength(5)
    // single row: every subpart shares y=0 and the parent stays one row tall
    expect(layout.children.every(c => c.y === 0)).toBe(true)
    expect(layout.height).toBe(mockDisplayConfig().featureHeight)
  })
})
