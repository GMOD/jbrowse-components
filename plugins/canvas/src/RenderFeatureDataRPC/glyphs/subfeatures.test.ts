import { LABEL_FONT_SIZE } from '../constants.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { layoutSubfeatures } from './subfeatures.ts'

import type { Feature } from '@jbrowse/core/util'

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

describe('layoutSubfeatures layout', () => {
  describe('subfeatureLabels = "below"', () => {
    it('allocates extra height for transcript labels', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const config = mockDisplayConfig({
        subfeatureLabels: 'below',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
      })

      const featureHeight = 10
      const fontHeight = LABEL_FONT_SIZE
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
      const config = mockDisplayConfig({
        subfeatureLabels: 'below',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
      })

      const featureHeight = 10
      const fontHeight = LABEL_FONT_SIZE
      expect(layout.height).toBe(featureHeight + fontHeight)
    })
  })

  describe('subfeatureLabels = "overlay"', () => {
    it('does not allocate extra height for labels', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const config = mockDisplayConfig({
        subfeatureLabels: 'overlay',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
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
      const config = mockDisplayConfig({
        subfeatureLabels: 'none',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
      })

      const featureHeight = 10
      expect(layout.children).toHaveLength(2)
      expect(layout.children[0]!.y).toBe(0)
      expect(layout.children[1]!.y).toBe(featureHeight + TRANSCRIPT_PADDING)
      expect(layout.height).toBe(featureHeight * 2 + TRANSCRIPT_PADDING)
    })
  })

  describe('geneGlyphMode = "longestCoding" isoformsCollapsed flag', () => {
    const config = mockDisplayConfig({ geneGlyphMode: 'longestCoding' })

    it('reports collapsed when multiple transcript isoforms exist', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      expect(
        layoutSubfeatures({ feature: gene, config }).isoformsCollapsed,
      ).toBe(true)
    })

    it('does not report collapsed when only one isoform exists', () => {
      // one real transcript alongside a non-transcript subfeature: no isoform
      // choice was actually collapsed, so the "Isoforms collapsed" notice must
      // stay off even though subfeatures.length > 1
      const mrna = mockFeature({
        type: 'mRNA',
        name: 'mRNA-1',
        start: 100,
        end: 500,
        subfeatures: [
          mockFeature({ type: 'CDS', name: 'cds', start: 200, end: 400 }),
        ],
      })
      const strayCds = mockFeature({
        type: 'CDS',
        name: 'stray',
        start: 600,
        end: 700,
      })
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 700,
        subfeatures: [mrna, strayCds],
      })
      expect(
        layoutSubfeatures({ feature: gene, config }).isoformsCollapsed,
      ).toBe(false)
    })
  })

  describe('hasMultipleIsoforms flag (drives the gene-glyph control)', () => {
    it('is true for a multi-isoform gene even when nothing is collapsed', () => {
      // 'all' mode renders every isoform, so isoformsCollapsed is false, but the
      // gene-glyph control must still appear since a choice among isoforms exists
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const layout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      expect(layout.hasMultipleIsoforms).toBe(true)
      expect(layout.isoformsCollapsed).toBe(false)
    })

    it('is false for a single-isoform gene', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1'])
      expect(
        layoutSubfeatures({
          feature: gene,
          config: mockDisplayConfig({ geneGlyphMode: 'all' }),
        }).hasMultipleIsoforms,
      ).toBe(false)
    })
  })

  describe('"below" vs "none" height comparison', () => {
    it('below mode produces taller gene glyph than none mode', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2', 'mRNA-3'])

      const belowLayout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
      })

      const noneLayout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ subfeatureLabels: 'none' }),
      })

      expect(belowLayout.height).toBeGreaterThan(noneLayout.height)
      const fontHeight = LABEL_FONT_SIZE
      expect(belowLayout.height - noneLayout.height).toBe(fontHeight * 3)
    })
  })

  describe('longestCoding CDS-length ranking', () => {
    const config = mockDisplayConfig({ geneGlyphMode: 'longestCoding' })

    function mrnaWithCds(name: string, cdsRanges: [number, number][]) {
      const start = Math.min(...cdsRanges.map(r => r[0]))
      const end = Math.max(...cdsRanges.map(r => r[1]))
      return mockFeature({
        type: 'mRNA',
        name,
        start,
        end,
        subfeatures: cdsRanges.map(([s, e], i) =>
          mockFeature({
            type: 'CDS',
            name: `${name}-cds-${i}`,
            start: s,
            end: e,
          }),
        ),
      })
    }

    it('picks the transcript with the longest protein, not the widest span', () => {
      // A: two CDS totalling 500 bp of protein. B: a single 450 bp CDS listed
      // twice (a real GFF3 quirk — dedupedSortedCDS handles it). Without deduping
      // in codingLength, B counts as 900 bp and wrongly wins.
      const a = mrnaWithCds('A', [
        [1000, 1300],
        [1400, 1600],
      ])
      const b = mrnaWithCds('B', [
        [2000, 2450],
        [2000, 2450],
      ])
      const gene = mockFeature({
        type: 'gene',
        name: 'g',
        start: 1000,
        end: 2450,
        subfeatures: [a, b],
      })
      const layout = layoutSubfeatures({ feature: gene, config })
      expect(layout.children).toHaveLength(1)
      expect(layout.children[0]!.feature.get('name')).toBe('A')
    })
  })

  describe('case-insensitive transcript-type matching', () => {
    it('recognizes a lowercase "mrna" as the sole isoform beside a stray sibling', () => {
      // isCDS/isExon and the featureAdmission gate all compare case-insensitively;
      // isoform detection must agree. Case-sensitive matching would fail to match
      // 'mrna', fall back to counting ALL subfeatures (the mrna + the stray CDS),
      // and wrongly report two isoforms. With case-insensitive matching the mrna
      // is the one recognized isoform, so the gene-glyph control stays hidden.
      const gene = mockFeature({
        type: 'gene',
        name: 'g',
        start: 100,
        end: 700,
        subfeatures: [
          mockFeature({
            type: 'mrna',
            name: 'iso1',
            start: 100,
            end: 500,
            subfeatures: [
              mockFeature({ type: 'CDS', name: 'c1', start: 200, end: 400 }),
            ],
          }),
          mockFeature({ type: 'CDS', name: 'stray', start: 600, end: 700 }),
        ],
      })
      expect(
        layoutSubfeatures({
          feature: gene,
          config: mockDisplayConfig({ geneGlyphMode: 'all' }),
        }).hasMultipleIsoforms,
      ).toBe(false)
    })
  })
})
