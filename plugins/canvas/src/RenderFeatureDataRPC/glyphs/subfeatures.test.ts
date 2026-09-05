import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from '../../LinearBasicDisplay/configSchema.ts'
import { trimIsoformStack } from '../../LinearBasicDisplay/isoformTrim.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { isoformGapPx } from './glyphUtils.ts'
import { layoutSubfeatures } from './subfeatures.ts'

import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  strand?: number
  subfeatures?: ReturnType<typeof mockFeature>[]
  attributes?: Record<string, unknown>
}): Feature {
  const {
    type,
    name,
    start,
    end,
    strand = 1,
    subfeatures = [],
    attributes = {},
  } = opts
  const f = {
    get: (key: string) => {
      const map: Record<string, unknown> = {
        type,
        name,
        start,
        end,
        strand,
        subfeatures,
        ...attributes,
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

// A transcript-shaped child with a single subpart, so it resolves the same glyph
// and draws the same label a real isoform does.
function isoform(type: string, name: string, i: number, child: string) {
  return mockFeature({
    type,
    name,
    start: 100 + i * 10,
    end: 500 + i * 10,
    subfeatures: [
      mockFeature({ type: child, name: `${name}-c`, start: 100, end: 200 }),
    ],
  })
}

const TRANSCRIPT_PADDING = 2

describe('layoutSubfeatures layout', () => {
  describe('subfeatureLabels = "below"', () => {
    // A label row's height is the display mode's label font size and the worker
    // is mode-agnostic, so the worker's geometry stays label-free and purely
    // proportional to the feature height.
    it('counts a label row per transcript and leaves the geometry label-free', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1', 'mRNA-2'])
      const config = mockDisplayConfig({
        subfeatureLabels: 'below',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
      })

      const featureHeight = 10

      expect(layout.children).toHaveLength(2)
      expect(layout.children[0]!.y).toBe(0)
      expect(layout.children[1]!.y).toBe(featureHeight + TRANSCRIPT_PADDING)
      expect(layout.children[0]!.labelRowsAbove).toBe(0)
      expect(layout.children[1]!.labelRowsAbove).toBe(1)
      expect(layout.height).toBe(featureHeight * 2 + TRANSCRIPT_PADDING)
      expect(layout.labelRows).toBe(2)
    })

    it('counts the row for a single transcript label', () => {
      const gene = makeGeneWithTranscripts(['mRNA-1'])
      const config = mockDisplayConfig({
        subfeatureLabels: 'below',
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config,
      })

      expect(layout.height).toBe(10)
      expect(layout.labelRows).toBe(1)
    })

    // The emitter labels every child it registers and never consults
    // `transcriptTypes`, so reserving by type draws a `lnc_RNA` isoform's label
    // over the row beneath it.
    it('counts a row for every child that draws its own label', () => {
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 2500,
        subfeatures: ['mRNA', 'lnc_RNA', 'misc_RNA'].map((type, i) =>
          isoform(type, `iso-${i}`, i, 'exon'),
        ),
      })

      const layout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ subfeatureLabels: 'below' }),
      })

      expect(layout.children).toHaveLength(3)
      expect(layout.labelRows).toBe(3)
      expect(layout.children.map(c => c.ownsLabelRow)).toEqual([
        true,
        true,
        true,
      ])
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
      // One real transcript beside a non-transcript subfeature: no isoform
      // choice collapsed, though subfeatures.length > 1.
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
      const layout = layoutSubfeatures({ feature: gene, config })
      expect(layout.isoformsCollapsed).toBe(false)
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'mRNA-1',
        'stray',
      ])
    })

    it('keeps the decorations beside the isoform it collapses to', () => {
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 700,
        subfeatures: [
          isoform('mRNA', 'mRNA-1', 0, 'CDS'),
          isoform('mRNA', 'mRNA-2', 1, 'CDS'),
          mockFeature({
            type: 'biological_region',
            name: 'promoter',
            start: 90,
            end: 100,
          }),
        ],
      })
      const layout = layoutSubfeatures({ feature: gene, config })
      expect(layout.isoformsCollapsed).toBe(true)
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'mRNA-2',
        'promoter',
      ])
    })

    it('reports collapsed when the second isoform is a non-coding one', () => {
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 500,
        subfeatures: [
          isoform('mRNA', 'mRNA-1', 0, 'CDS'),
          isoform('lnc_RNA', 'XR-1', 1, 'exon'),
        ],
      })
      const layout = layoutSubfeatures({ feature: gene, config })
      expect(layout.isoformsCollapsed).toBe(true)
      expect(layout.hasMultipleIsoforms).toBe(true)
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'mRNA-1',
      ])
    })
  })

  // The trim itself is main-thread; what is pinned here is the table it reads.
  describe('isoform stack', () => {
    const trimmedNames = (names: string[], maxIsoforms: number) => {
      const layout = layoutSubfeatures({
        feature: makeGeneWithTranscripts(names),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      const kept = trimIsoformStack(stack, maxIsoforms).keptOrdinals
      return stack.children
        .filter(c => kept.has(c.ordinal))
        .map(c => layout.children[c.ordinal]!.feature.get('name'))
    }

    it('ships every isoform and counts them', () => {
      const layout = layoutSubfeatures({
        feature: makeGeneWithTranscripts(['a', 'b', 'c', 'd', 'e']),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      expect(layout.children).toHaveLength(5)
      expect(layout.isoformsCollapsed).toBe(false)
      expect(layout.isoformStack).toMatchObject({ isoformCount: 5 })
      expect(layout.isoformStack!.children).toHaveLength(5)
    })

    // The trim closes the hole a dropped isoform leaves with the same number the
    // layout opened it with.
    it('carries the box the inter-transcript gap is spent from', () => {
      const layout = layoutSubfeatures({
        feature: makeGeneWithTranscripts(['a', 'b']),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      const [first, second] = stack.children
      expect(second!.yPx - (first!.yPx + first!.heightPx)).toBeCloseTo(
        isoformGapPx(stack),
      )
    })

    // Every isoform here has the same 100bp CDS, so the later-wins tiebreak is
    // what decides.
    it('ranks so a trim to one agrees with the longestCoding collapse', () => {
      const names = ['a', 'b', 'c']
      const longest = layoutSubfeatures({
        feature: makeGeneWithTranscripts(names),
        config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
      }).children.map(c => c.feature.get('name'))
      expect(trimmedNames(names, 1)).toEqual(longest)
    })

    it('ranks a longer protein above a shorter one', () => {
      const short = mockFeature({
        type: 'mRNA',
        name: 'short',
        start: 100,
        end: 500,
        subfeatures: [
          mockFeature({ type: 'CDS', name: 's', start: 100, end: 150 }),
        ],
      })
      const long = mockFeature({
        type: 'mRNA',
        name: 'long',
        start: 100,
        end: 500,
        subfeatures: [
          mockFeature({ type: 'CDS', name: 'l', start: 100, end: 400 }),
        ],
      })
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 500,
        subfeatures: [short, long],
      })
      const layout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      const kept = trimIsoformStack(stack, 1).keptOrdinals
      expect(
        stack.children
          .filter(c => kept.has(c.ordinal))
          .map(c => layout.children[c.ordinal]!.feature.get('name')),
      ).toEqual(['long'])
    })

    it('leaves the survivors in the order they would have had', () => {
      expect(trimmedNames(['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c'])
    })

    // `transcriptTypes` names none of the non-coding types NCBI hangs off a gene
    // beside its mRNAs.
    it('counts isoforms transcriptTypes does not name', () => {
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 2500,
        subfeatures: [
          ...['m0', 'm1'].map((name, i) => isoform('mRNA', name, i, 'CDS')),
          ...['x0', 'x1', 'x2'].map((name, i) =>
            isoform('lnc_RNA', name, i, 'exon'),
          ),
        ],
      })
      const layout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      expect(stack.isoformCount).toBe(5)
      const kept = trimIsoformStack(stack, 2).keptOrdinals
      expect(
        stack.children
          .filter(c => kept.has(c.ordinal))
          .map(c => layout.children[c.ordinal]!.feature.get('type')),
      ).toEqual(['mRNA', 'mRNA'])
    })

    // The gene ships one child and still counts them all, so the badge reads the
    // same way from either source.
    it('counts every isoform under longestCoding too', () => {
      const layout = layoutSubfeatures({
        feature: makeGeneWithTranscripts(['a', 'b', 'c']),
        config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
      })
      expect(layout.children).toHaveLength(1)
      expect(layout.isoformStack).toMatchObject({ isoformCount: 3 })
    })
  })

  describe('canonical transcript tag', () => {
    // 'short' is tagged and 'long' has three times the CDS, so every assertion
    // below is the tag beating the measurement. `tagLast` puts the tagged one
    // second, where only a reorder can bring it to the front.
    function geneWithTag(attributes: Record<string, unknown>, tagLast = false) {
      const short = mockFeature({
        type: 'mRNA',
        name: 'short',
        start: 100,
        end: 500,
        attributes,
        subfeatures: [
          mockFeature({ type: 'CDS', name: 's', start: 100, end: 200 }),
        ],
      })
      const long = mockFeature({
        type: 'mRNA',
        name: 'long',
        start: 100,
        end: 500,
        subfeatures: [
          mockFeature({ type: 'CDS', name: 'l', start: 100, end: 400 }),
        ],
      })
      return mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 500,
        subfeatures: tagLast ? [long, short] : [short, long],
      })
    }

    const names = (
      attributes: Record<string, unknown>,
      overrides: Parameters<typeof mockDisplayConfig>[0] = {},
    ) =>
      layoutSubfeatures({
        feature: geneWithTag(attributes),
        config: mockDisplayConfig({
          geneGlyphMode: 'longestCoding',
          ...overrides,
        }),
      }).children.map(c => c.feature.get('name'))

    it('outranks a longer protein', () => {
      expect(names({ tag: 'RefSeq Select' })).toEqual(['short'])
    })

    it('matches one member of a multi-valued attribute', () => {
      // gff-nostream hands a comma list back as an array.
      expect(names({ tag: ['MANE Select', 'RefSeq Select'] })).toEqual([
        'short',
      ])
    })

    it('matches case-insensitively', () => {
      expect(names({ tag: 'refseq select' })).toEqual(['short'])
    })

    it('ignores a tag the config does not name', () => {
      expect(names({ tag: 'RefSeq Select' }, { canonicalTranscriptTags: [] })) //
        .toEqual(['long'])
      expect(names({ tag: 'basic' })).toEqual(['long'])
    })

    it('reads whichever attribute the config names', () => {
      expect(
        names(
          { transcript_support: 'RefSeq Select' },
          { canonicalTranscriptField: 'transcript_support' },
        ),
      ).toEqual(['short'])
      expect(names({ transcript_support: 'RefSeq Select' })).toEqual(['long'])
    })

    // mockDisplayConfig carries a two-entry stand-in, so a test asserting on the
    // shipped list has to read the slot to mean anything.
    const pm = new PluginManager([])
    pm.createPluggableElements()
    pm.configure()
    const shippedTags = readConfObject(
      configSchemaFactory(pm).create(
        { displayId: 'shipped', type: 'LinearBasicDisplay' },
        { pluginManager: pm },
      ),
      'canonicalTranscriptTags',
    )

    // Two tagged isoforms with the longer protein second, so only the list's
    // priority order can bring the first one to the front.
    function geneWithTwoTags(shortTag: string, longTag: string) {
      const tagged = (name: string, cdsEnd: number, tag: string) =>
        mockFeature({
          type: 'mRNA',
          name,
          start: 100,
          end: 500,
          attributes: { tag },
          subfeatures: [
            mockFeature({
              type: 'CDS',
              name: `${name}-c`,
              start: 100,
              end: cdsEnd,
            }),
          ],
        })
      return mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 500,
        subfeatures: [
          tagged('short', 200, shortTag),
          tagged('long', 400, longTag),
        ],
      })
    }

    const shippedNames = (feature: Feature) =>
      layoutSubfeatures({
        feature,
        config: mockDisplayConfig({
          geneGlyphMode: 'longestCoding',
          canonicalTranscriptTags: shippedTags,
        }),
      }).children.map(c => c.feature.get('name'))

    // MANE Plus Clinical marks an ADDITIONAL transcript beside the MANE Select
    // one and is often the longer, so one gene carries both tags at once.
    it('prefers the earlier tag in the list over a longer protein', () => {
      expect(
        shippedNames(geneWithTwoTags('MANE Select', 'MANE Plus Clinical')),
      ).toEqual(['short'])
    })

    // GENCODE spells the MANE tags with underscores where NCBI's GFF3 uses
    // spaces, and canonicalRank compares list members whole, so the default needs
    // both spellings of every tag.
    describe("GENCODE's underscore spelling", () => {
      it('is recognised for MANE_Plus_Clinical', () => {
        expect(
          names(
            { tag: 'MANE_Plus_Clinical' },
            { canonicalTranscriptTags: shippedTags },
          ),
        ).toEqual(['short'])
      })

      it('keeps MANE_Plus_Clinical ranked under MANE_Select', () => {
        expect(
          shippedNames(geneWithTwoTags('MANE_Select', 'MANE_Plus_Clinical')),
        ).toEqual(['short'])
      })
    })

    it('is the first isoform a trim to one keeps', () => {
      const layout = layoutSubfeatures({
        feature: geneWithTag({ tag: 'RefSeq Select' }),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      const kept = trimIsoformStack(stack, 1).keptOrdinals
      expect(
        stack.children
          .filter(c => kept.has(c.ordinal))
          .map(c => layout.children[c.ordinal]!.feature.get('name')),
      ).toEqual(['short'])
    })

    // Both isoforms here are coding, so the coding-first stack sort is a no-op
    // and only the tag can reorder them.
    it('stacks on top of the untagged isoforms', () => {
      const layout = layoutSubfeatures({
        feature: geneWithTag({ tag: 'RefSeq Select' }, true),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'short',
        'long',
      ])
      expect(layout.children[0]!.y).toBe(0)
    })

    it('leaves an untagged gene stacked in its original order', () => {
      const layout = layoutSubfeatures({
        feature: geneWithTag({}, true),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'long',
        'short',
      ])
    })

    // The on-canvas chip names the tag rather than the count of what is hidden,
    // so a collapsed gene has to report which rule kept the transcript it kept.
    describe('the tag reported to the chip', () => {
      const tagOf = (
        attributes: Record<string, unknown>,
        overrides: Parameters<typeof mockDisplayConfig>[0] = {},
      ) =>
        layoutSubfeatures({
          feature: geneWithTag(attributes),
          config: mockDisplayConfig({
            geneGlyphMode: 'longestCoding',
            ...overrides,
          }),
        }).canonicalTag

      // Two spellings of one tag count as one rule rather than splitting the
      // chip's majority.
      it('is the config spelling of the tag that won', () => {
        expect(tagOf({ tag: 'refseq select' })).toBe('RefSeq Select')
        expect(tagOf({ tag: ['MANE Select', 'RefSeq Select'] })).toBe(
          'MANE Select',
        )
      })

      it('is absent when protein length decided it', () => {
        expect(tagOf({})).toBeUndefined()
        expect(tagOf({ tag: 'basic' })).toBeUndefined()
      })

      // The trim that reads the stack is the one hiding transcripts under `all`,
      // and the chip credits the same rule either way.
      it('rides on the isoform stack for the main-thread trim', () => {
        expect(
          layoutSubfeatures({
            feature: geneWithTag({ tag: 'RefSeq Select' }),
            config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
          }).isoformStack?.canonicalTag,
        ).toBe('RefSeq Select')
      })

      it('is absent on a gene that kept every isoform', () => {
        expect(tagOf({ tag: 'RefSeq Select' }, { geneGlyphMode: 'all' })) //
          .toBeUndefined()
      })
    })
  })

  describe('hasMultipleIsoforms flag (drives the gene-glyph control)', () => {
    it('is true for a multi-isoform gene even when nothing is collapsed', () => {
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

      expect(belowLayout.height).toBe(noneLayout.height)
      expect(belowLayout.labelRows).toBe(3)
      expect(noneLayout.labelRows).toBe(0)
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
      // twice, which counts as 900 bp and wrongly wins without the dedup.
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
      // A case-sensitive match would miss 'mrna', fall back to counting ALL
      // subfeatures, and report two isoforms.
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

  // NCBI RefSeq annotates a viral genome as gene → CDS → mature_protein_region,
  // so the CDS is the isoform AND the coding feature: nothing under it is
  // another CDS.
  describe('polyprotein CDS isoform', () => {
    const PRODUCTS = 16
    const PRODUCT_WIDTH = 400
    const POLYPROTEIN_START = 700

    // `precursor` adds the uncleaved product RefSeq annotates beside the two it
    // cleaves into, which makes the products cover 800bp of the CDS twice.
    function polyprotein({ precursor = false } = {}) {
      const products = Array.from({ length: PRODUCTS }, (_, i) =>
        mockFeature({
          type: 'mature_protein_region_of_CDS',
          name: `product-${i}`,
          start: POLYPROTEIN_START + i * PRODUCT_WIDTH,
          end: POLYPROTEIN_START + (i + 1) * PRODUCT_WIDTH,
        }),
      )
      return mockFeature({
        type: 'CDS',
        name: 'polyprotein',
        start: POLYPROTEIN_START,
        end: POLYPROTEIN_START + PRODUCTS * PRODUCT_WIDTH,
        subfeatures: precursor
          ? [
              mockFeature({
                type: 'mature_protein_region_of_CDS',
                name: 'precursor',
                start: POLYPROTEIN_START,
                end: POLYPROTEIN_START + 2 * PRODUCT_WIDTH,
              }),
              ...products,
            ]
          : products,
      })
    }

    function plainTranscript(name: string, cdsLength: number) {
      return mockFeature({
        type: 'mRNA',
        name,
        start: 100,
        end: 200 + cdsLength,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            name: `${name}-cds`,
            start: 100,
            end: 100 + cdsLength,
          }),
        ],
      })
    }

    // The polyprotein comes first, so a ranking that reads it as non-coding has
    // to move it for the stack order to change.
    function viralGene() {
      return mockFeature({
        type: 'gene',
        name: 'ORF1ab',
        start: 100,
        end: POLYPROTEIN_START + PRODUCTS * PRODUCT_WIDTH,
        subfeatures: [
          polyprotein(),
          plainTranscript('tx1', 300),
          plainTranscript('tx2', 400),
          plainTranscript('tx3', 500),
        ],
      })
    }

    const names = (layout: ReturnType<typeof layoutSubfeatures>) =>
      layout.children.map(c => c.feature.get('name'))

    it("survives longestCoding against the gene's plain mRNAs", () => {
      const layout = layoutSubfeatures({
        feature: viralGene(),
        config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
      })
      expect(names(layout)).toEqual(['polyprotein'])
    })

    // A 16-product polyprotein is one isoform and 16 rows tall, which is why the
    // trim prices a gene in px off the stack rather than counting rows.
    it('carries its real height on the isoform stack', () => {
      const layout = layoutSubfeatures({
        feature: viralGene(),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const [polyprotein, tx1] = layout.isoformStack!.children
      expect(polyprotein!.heightPx).toBeGreaterThan(tx1!.heightPx * 4)
    })

    it('outranks the plain mRNAs beside it', () => {
      const layout = layoutSubfeatures({
        feature: viralGene(),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      const stack = layout.isoformStack!
      const kept = trimIsoformStack(stack, 1).keptOrdinals
      expect(
        stack.children
          .filter(c => kept.has(c.ordinal))
          .map(c => layout.children[c.ordinal]!.feature.get('name')),
      ).toEqual(['polyprotein'])
    })

    it('stacks on top when nothing is collapsed', () => {
      const layout = layoutSubfeatures({
        feature: viralGene(),
        config: mockDisplayConfig({ geneGlyphMode: 'all' }),
      })
      expect(layout.isoformsCollapsed).toBe(false)
      expect(names(layout)).toEqual(['polyprotein', 'tx1', 'tx2', 'tx3'])
    })

    // A polyprotein ranks by its CDS span, the protein the translator reads out
    // of it. Its cleavage products can cover the same bases twice — here they sum
    // to 7200 against a 6400bp CDS, and a longer 6800bp protein still has to win.
    it('loses to a genuinely longer protein', () => {
      const gene = mockFeature({
        type: 'gene',
        name: 'g',
        start: 100,
        end: POLYPROTEIN_START + PRODUCTS * PRODUCT_WIDTH,
        subfeatures: [
          polyprotein({ precursor: true }),
          plainTranscript('longer', 6800),
        ],
      })
      const layout = layoutSubfeatures({
        feature: gene,
        config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
      })
      expect(names(layout)).toEqual(['longer'])
    })
  })
})
