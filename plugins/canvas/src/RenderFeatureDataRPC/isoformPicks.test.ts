import {
  anyIsoformsHidden,
  isoformPickEntries,
  mergeIsoformPicks,
  summarizeIsoformPicks,
} from './isoformPicks.ts'

import type { FeatureLayout } from './types.ts'

// Only the three fields the summary reads. Its input is a whole region's
// top-level layouts, which carry a Feature apiece and are not worth building
// here — subfeatures.test.ts is where the fields themselves are pinned.
const gene = (
  isoformsCollapsed: boolean,
  canonicalTag?: string,
): FeatureLayout =>
  ({ isoformsCollapsed, canonicalTag }) as unknown as FeatureLayout

describe('summarizeIsoformPicks', () => {
  it('counts each collapsed gene under the rule that picked it', () => {
    expect(
      summarizeIsoformPicks([
        gene(true, 'MANE Select'),
        gene(true, 'MANE Select'),
        gene(true, 'RefSeq Select'),
        gene(true),
      ]),
    ).toEqual({ byTag: { 'MANE Select': 2, 'RefSeq Select': 1 }, byLength: 1 })
  })

  // NCBI's GFF3 writes `tag=MANE Select`, GENCODE's writes `tag=MANE_Select`,
  // and canonicalTranscriptTags lists both so either file ranks — but they are
  // one curated decision, and split apart they split the chip's majority.
  it('counts the two spellings of a tag as one rule', () => {
    expect(
      summarizeIsoformPicks([
        gene(true, 'MANE Select'),
        gene(true, 'MANE_Select'),
        gene(true, 'Ensembl_canonical'),
      ]),
    ).toEqual({
      byTag: { 'MANE Select': 2, 'Ensembl canonical': 1 },
      byLength: 0,
    })
  })

  // A gene keeping every isoform has no pick to report — the height cap fires
  // per gene, so a region holds both kinds at once.
  it('ignores the genes that kept every isoform', () => {
    expect(
      summarizeIsoformPicks([gene(false, 'MANE Select'), gene(false)]),
    ).toEqual({ byTag: {}, byLength: 0 })
  })
})

describe('mergeIsoformPicks', () => {
  // the chip speaks for the whole view, and the view is one summary per region
  it('sums the regions', () => {
    expect(
      mergeIsoformPicks([
        { byTag: { 'MANE Select': 2 }, byLength: 1 },
        { byTag: { 'MANE Select': 3, 'RefSeq Select': 1 }, byLength: 4 },
      ]),
    ).toEqual({ byTag: { 'MANE Select': 5, 'RefSeq Select': 1 }, byLength: 5 })
  })

  // fixtures, and any region fetched before this field existed
  it('skips a region that reported nothing', () => {
    expect(mergeIsoformPicks([undefined, undefined])).toEqual({
      byTag: {},
      byLength: 0,
    })
  })
})

describe('isoformPickEntries', () => {
  it('reads commonest first, with the length fallback last', () => {
    expect(
      isoformPickEntries({
        byTag: { 'RefSeq Select': 3, 'MANE Select': 9 },
        byLength: 40,
      }),
    ).toEqual([
      ['MANE Select', 9],
      ['RefSeq Select', 3],
      ['longest coding', 40],
    ])
  })

  // otherwise panning between two equally common tags swaps the chip's word
  it('breaks a tie by name', () => {
    expect(
      isoformPickEntries({
        byTag: { 'RefSeq Select': 4, 'Ensembl canonical': 4 },
        byLength: 0,
      }).map(([rule]) => rule),
    ).toEqual(['Ensembl canonical', 'RefSeq Select'])
  })
})

// The model gates the height cap's chip on this: a cap every gene in view fits
// inside hides nothing and must not be announced.
describe('anyIsoformsHidden', () => {
  it('is false only when no rule picked anything', () => {
    expect(anyIsoformsHidden({ byTag: {}, byLength: 0 })).toBe(false)
    expect(anyIsoformsHidden(undefined)).toBe(false)
    expect(anyIsoformsHidden({ byTag: {}, byLength: 1 })).toBe(true)
    expect(
      anyIsoformsHidden({ byTag: { 'MANE Select': 1 }, byLength: 0 }),
    ).toBe(true)
  })
})
