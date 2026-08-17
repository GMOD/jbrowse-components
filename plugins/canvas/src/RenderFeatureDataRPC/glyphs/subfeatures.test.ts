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
  // extra attributes, e.g. the `tag` an NCBI GFF3 carries RefSeq Select in
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

// One isoform of a gene: a transcript-shaped child with a single subpart, so it
// resolves the same glyph and draws the same label a real one does. `child`
// picks coding (CDS) or non-coding (exon).
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
    // The label ROW is counted here, never added to a Y or a height: its height
    // is the display mode's label font size and the worker is mode-agnostic, so
    // the main thread spends it (see reservesBelowLabelRow). What this asserts is
    // that the worker's own geometry stays label-free and purely proportional to
    // the feature height — the property that makes the main thread's uniform
    // compact scale exact.
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
      // stacked on body + padding alone; the first transcript's label row is a
      // count the second one carries, not px in its offset
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
    // `transcriptTypes`, so reserving by type left a `lnc_RNA` isoform's label
    // drawn over the row beneath it — the same overlap the reservation exists
    // to prevent, reached through the type gate rather than the multiplier.
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
      const layout = layoutSubfeatures({ feature: gene, config })
      expect(layout.isoformsCollapsed).toBe(false)
      // and the stray stays drawn: collapsing isoforms is not a licence to drop
      // the decorations beside them, which replacing the child list with the
      // isoform list outright used to do
      expect(layout.children.map(c => c.feature.get('name'))).toEqual([
        'mRNA-1',
        'stray',
      ])
    })

    // The cap leaves them alone and this is the cap at one, so it does too.
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

    // A gene with one mRNA and one lnc_RNA used to collapse to the mRNA while
    // reporting nothing collapsed and no isoform choice to make — so the
    // lnc_RNA vanished with no control offering it back, and the gene's label
    // still anchored to the span of what was no longer drawn.
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

  // The row budget `auto` derives from the track height
  // (effectiveMaxIsoforms), so a gene with 28 transcripts does not draw all 28
  // inside a 100px lane's own scrollbar.
  describe('maxIsoforms cap', () => {
    const capped = (names: string[], maxIsoforms: number | undefined) =>
      layoutSubfeatures({
        feature: makeGeneWithTranscripts(names),
        config: mockDisplayConfig({ geneGlyphMode: 'all', maxIsoforms }),
      })

    it('keeps every isoform when the gene already fits', () => {
      const layout = capped(['a', 'b', 'c'], 5)
      expect(layout.children).toHaveLength(3)
      expect(layout.isoformsCollapsed).toBe(false)
    })

    it('keeps only the cap when it does not, and says isoforms are hidden', () => {
      const layout = capped(['a', 'b', 'c', 'd', 'e'], 2)
      expect(layout.children).toHaveLength(2)
      // the flag longestCoding sets: the label and hit box anchor to what drew
      expect(layout.isoformsCollapsed).toBe(true)
      expect(layout.hasMultipleIsoforms).toBe(true)
    })

    // every isoform here has the same 100bp CDS, so this exercises the
    // later-wins tiebreak the two share
    it('agrees with the longestCoding collapse at a cap of one', () => {
      const names = ['a', 'b', 'c']
      const one = capped(names, 1).children.map(c => c.feature.id())
      const longest = layoutSubfeatures({
        feature: makeGeneWithTranscripts(names),
        config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
      }).children.map(c => c.feature.id())
      expect(one).toEqual(longest)
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
        config: mockDisplayConfig({ geneGlyphMode: 'all', maxIsoforms: 1 }),
      })
      expect(layout.children.map(c => c.feature.get('name'))).toEqual(['long'])
    })

    it('leaves the survivors in the order they would have had', () => {
      const uncapped = capped(['a', 'b', 'c'], undefined).children.map(c =>
        c.feature.get('name'),
      )
      expect(
        capped(['a', 'b', 'c'], 3).children.map(c => c.feature.get('name')),
      ).toEqual(uncapped)
    })

    it('does not apply on top of longestCoding', () => {
      const layout = layoutSubfeatures({
        feature: makeGeneWithTranscripts(['a', 'b', 'c']),
        config: mockDisplayConfig({
          geneGlyphMode: 'longestCoding',
          maxIsoforms: 2,
        }),
      })
      expect(layout.children).toHaveLength(1)
    })

    // `transcriptTypes` names seven types and none of the non-coding ones NCBI
    // hangs off a gene beside its mRNAs, so a cap that counted only its members
    // left every `lnc_RNA`/`misc_RNA` isoform exempt: a gene capped at 2 drew
    // 7, which is the overflow the cap exists to end reached a different way.
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
        config: mockDisplayConfig({ geneGlyphMode: 'all', maxIsoforms: 2 }),
      })
      expect(layout.children).toHaveLength(2)
      // coding still ranks above non-coding, so the two mRNAs are the survivors
      expect(layout.children.map(c => c.feature.get('type'))).toEqual([
        'mRNA',
        'mRNA',
      ])
    })
  })

  // NCBI's GFF3 marks the gene's representative isoform with `tag=RefSeq
  // Select` (Ensembl/GENCODE with MANE_Select / Ensembl_canonical), which is a
  // curator's answer to the question both collapses are asking. It outranks
  // protein length, so the same tag decides what `longestCoding` shows and what
  // the height cap keeps first.
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
      // gff-nostream hands a comma list back as an array
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
      // and not the default one, so the field is a real gate
      expect(names({ transcript_support: 'RefSeq Select' })).toEqual(['long'])
    })

    // The default list holds two tags one gene carries at once: MANE Plus
    // Clinical marks an ADDITIONAL transcript beside the MANE Select one, and
    // it is often the longer. Flattened to a boolean "tagged", the
    // coding-length tiebreak then picked between them by a coin flip; the list
    // is read as a priority order, so the earlier tag wins outright.
    it('prefers the earlier tag in the list over a longer protein', () => {
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
      const gene = mockFeature({
        type: 'gene',
        name: 'TestGene',
        start: 100,
        end: 500,
        subfeatures: [
          tagged('short', 200, 'MANE Select'),
          tagged('long', 400, 'MANE Plus Clinical'),
        ],
      })
      expect(
        layoutSubfeatures({
          feature: gene,
          config: mockDisplayConfig({ geneGlyphMode: 'longestCoding' }),
        }).children.map(c => c.feature.get('name')),
      ).toEqual(['short'])
    })

    it('is the first isoform the height cap keeps', () => {
      expect(
        names(
          { tag: 'RefSeq Select' },
          { geneGlyphMode: 'all', maxIsoforms: 1 },
        ),
      ).toEqual(['short'])
    })

    // The isoform a capped gene keeps first should also be the one it draws
    // first, so the gene reads top-down. Both isoforms here are coding, so the
    // coding-first stack sort is a no-op and only the tag can reorder them.
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

    // The on-canvas chip names this tag rather than the count of what is
    // hidden, so a collapsed gene has to report which rule kept the transcript
    // it kept — see isoformPicks.ts, which counts these across a region.
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

      // the config's spelling, not the file's, so two spellings of one tag are
      // counted as one rule rather than splitting the chip's majority
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

      it('names the tag under the height cap too', () => {
        expect(
          tagOf(
            { tag: 'RefSeq Select' },
            { geneGlyphMode: 'all', maxIsoforms: 1 },
          ),
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

      // Same worker geometry either way — the difference is the counted rows,
      // which the main thread turns into px at the mode's label font size.
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
