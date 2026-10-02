import {
  DEFAULT_CANONICAL_TRANSCRIPTS,
  featureIsoformReader,
  isCodingIsoform,
  isoformScorer,
  rankIsoforms,
  serializedIsoformReader,
} from './isoformRank.ts'
import SimpleFeature from './simpleFeature.ts'

import type { SimpleFeatureSerializedNoId } from './simpleFeature.ts'

function feat(
  type: string,
  start: number,
  end: number,
  subfeatures: SimpleFeatureSerializedNoId[] = [],
  extra: Record<string, unknown> = {},
): SimpleFeatureSerializedNoId {
  return { refName: 'chr1', type, start, end, subfeatures, ...extra }
}

// A feature is coding because a CDS is there — itself, or anywhere below it —
// never because of what hangs off that CDS.
describe('isCodingIsoform', () => {
  const coding = (f: SimpleFeatureSerializedNoId) =>
    isCodingIsoform(serializedIsoformReader, f)

  test('a CDS with no children of its own', () => {
    expect(coding(feat('CDS', 100, 400))).toBe(true)
  })

  test('a polyprotein CDS whose children are cleavage products', () => {
    expect(
      coding(
        feat('CDS', 100, 900, [
          feat('mature_protein_region_of_CDS', 100, 500),
          feat('mat_peptide', 500, 900),
        ]),
      ),
    ).toBe(true)
  })

  test('a CDS anywhere below (gene → mRNA → CDS)', () => {
    expect(
      coding(
        feat('gene', 0, 1000, [feat('mRNA', 0, 1000, [feat('CDS', 100, 900)])]),
      ),
    ).toBe(true)
  })

  test('an exon-only transcript is not', () => {
    expect(coding(feat('lnc_RNA', 0, 1000, [feat('exon', 100, 900)]))).toBe(
      false,
    )
  })
})

describe('rankIsoforms', () => {
  const isoforms = [
    feat('mRNA', 0, 5000, [feat('CDS', 0, 3000)]),
    feat('mRNA', 0, 1000, [feat('CDS', 0, 600)], { tag: 'RefSeq Select' }),
    feat('mRNA', 0, 1000, [feat('CDS', 0, 500)], { tag: 'MANE Select' }),
    feat('lnc_RNA', 0, 9000, [feat('exon', 0, 9000)]),
  ]

  test('serialized and live features rank the same', () => {
    const serialized = rankIsoforms(
      isoforms,
      isoformScorer(serializedIsoformReader, DEFAULT_CANONICAL_TRANSCRIPTS),
    ).map(f => isoforms.indexOf(f))
    const live = isoforms.map(
      (f, i) => new SimpleFeature({ ...f, uniqueId: `t${i}` }),
    )
    const ranked = rankIsoforms(
      live,
      isoformScorer(featureIsoformReader, DEFAULT_CANONICAL_TRANSCRIPTS),
    ).map(f => live.indexOf(f))
    expect(serialized).toEqual([2, 1, 0, 3])
    expect(ranked).toEqual(serialized)
  })

  test('an empty tag list ranks by measurement alone', () => {
    const ranked = rankIsoforms(
      isoforms,
      isoformScorer(serializedIsoformReader, { field: 'tag', tags: [] }),
    ).map(f => isoforms.indexOf(f))
    expect(ranked).toEqual([0, 1, 2, 3])
  })
})
