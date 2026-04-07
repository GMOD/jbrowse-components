import { subfeaturesGlyph } from './subfeatures.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

// mock config has labels.name = '' to match the RPC worker's mock config
function createMockConfigContext(
  overrides: Partial<RenderConfigContext> = {},
): RenderConfigContext {
  return {
    config: {
      labels: { name: '', description: '', fontSize: 12 },
      subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    } as any,
    displayMode: 'normal',
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    containerTypes: [],
    geneGlyphMode: 'all',
    displayDirectionalChevrons: true,
    color1: { value: 'goldenrod', isCallback: false },
    color2: { value: '#f0f', isCallback: false },
    color3: { value: '#357089', isCallback: false },
    outline: { value: '', isCallback: false },
    featureHeight: { value: 10, isCallback: false },
    fontHeight: { value: 12, isCallback: false },
    nameColor: { value: 'black', isCallback: false },
    descriptionColor: { value: 'blue', isCallback: false },
    labelAllowed: true,
    heightMultiplier: 1,
    ...overrides,
  }
}

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  strand?: number
  subfeatures?: ReturnType<typeof mockFeature>[]
}): Feature {
  const { type, name, start, end, strand = 1, subfeatures = [] } = opts
  const f = {
    get: (key: string) => {
      const map: Record<string, unknown> = {
        type,
        name,
        start,
        end,
        strand,
        subfeatures,
      }
      return map[key]
    },
    id: () => `${type}-${name}-${start}-${end}`,
    parent: () => undefined,
  }
  return f as unknown as Feature
}

function makeGeneWithTranscripts(transcriptNames: string[]) {
  const transcripts = transcriptNames.map((name, i) => {
    const cds = mockFeature({
      type: 'CDS',
      name: `${name}-cds`,
      start: 100 + i * 1000,
      end: 200 + i * 1000,
    })
    return mockFeature({
      type: 'mRNA',
      name,
      start: 100 + i * 1000,
      end: 500 + i * 1000,
      subfeatures: [cds],
    })
  })

  return mockFeature({
    type: 'gene',
    name: 'TestGene',
    start: 100,
    end: 2500,
    subfeatures: transcripts,
  })
}

const TRANSCRIPT_PADDING = 2

describe('subfeaturesGlyph layout', () => {
  describe('subfeatureLabels = "below"', () => {
    it('allocates extra height for transcript labels', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const configContext = createMockConfigContext({
        subfeatureLabels: 'below',
      })

      const layout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      const featureHeight = 10
      const fontHeight = 12
      const expectedTranscriptTotalHeight = featureHeight + fontHeight

      expect(layout.children).toHaveLength(2)
      expect(layout.children[0]!.y).toBe(0)
      expect(layout.children[1]!.y).toBe(
        expectedTranscriptTotalHeight + TRANSCRIPT_PADDING,
      )
      expect(layout.height).toBe(
        expectedTranscriptTotalHeight * 2 + TRANSCRIPT_PADDING,
      )
    })

    it('allocates space for a single transcript label', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1'])
      const configContext = createMockConfigContext({
        subfeatureLabels: 'below',
      })

      const layout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      const featureHeight = 10
      const fontHeight = 12
      expect(layout.height).toBe(featureHeight + fontHeight)
    })
  })

  describe('subfeatureLabels = "overlay"', () => {
    it('does not allocate extra height for labels', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const configContext = createMockConfigContext({
        subfeatureLabels: 'overlay',
      })

      const layout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      const featureHeight = 10
      expect(layout.children).toHaveLength(2)
      expect(layout.children[0]!.y).toBe(0)
      expect(layout.children[1]!.y).toBe(featureHeight + TRANSCRIPT_PADDING)
      expect(layout.height).toBe(featureHeight * 2 + TRANSCRIPT_PADDING)
    })
  })

  describe('subfeatureLabels = "none"', () => {
    it('does not allocate extra height for labels', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const configContext = createMockConfigContext({
        subfeatureLabels: 'none',
      })

      const layout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext,
      })

      const featureHeight = 10
      expect(layout.children).toHaveLength(2)
      expect(layout.children[0]!.y).toBe(0)
      expect(layout.children[1]!.y).toBe(featureHeight + TRANSCRIPT_PADDING)
      expect(layout.height).toBe(featureHeight * 2 + TRANSCRIPT_PADDING)
    })
  })

  describe('"below" vs "none" height comparison', () => {
    it('below mode produces taller gene glyph than none mode', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2', 'mRNA-3'])

      const belowLayout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext: createMockConfigContext({ subfeatureLabels: 'below' }),
      })

      const noneLayout = subfeaturesGlyph.layout({
        feature: gene,
        bpPerPx: 1,
        reversed: false,
        configContext: createMockConfigContext({ subfeatureLabels: 'none' }),
      })

      expect(belowLayout.height).toBeGreaterThan(noneLayout.height)
      const fontHeight = 12
      expect(belowLayout.height - noneLayout.height).toBe(fontHeight * 3)
    })
  })
})
