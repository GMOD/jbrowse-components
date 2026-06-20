import { featureData, parseGtf } from './util.ts'

import type { FeatureLoc } from './util.ts'

function makeLoc(attributes: Record<string, unknown[]>): FeatureLoc {
  return {
    start: 1,
    end: 100,
    strand: '+',
    seq_name: 'ctgA',
    attributes,
  }
}

test('strips GTF quotes from single- and multi-value attributes alike', () => {
  const f = featureData(
    makeLoc({
      gene_id: ['"ENSG01"'],
      tag: ['"basic"', '"CCDS"'],
    }),
  )
  expect(f.gene_id).toBe('ENSG01')
  expect(f.tag).toEqual(['basic', 'CCDS'])
})

test('keeps a comma inside an attribute value intact', () => {
  // GTF expresses multiple values via repeated keys, not comma separation, so a
  // comma inside a quoted value must not split it
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"; note "a, b";'
  const [transcript] = parseGtf(gtf)
  const exon = featureData(transcript!.child_features![0]![0]!)
  expect(exon.note).toBe('a, b')
})

test('strips CRLF carriage returns so the final attribute is not corrupted', () => {
  // tabix-read CRLF lines carry a trailing \r; without a trailing ';' it lands
  // inside transcript_id, which drives both grouping and the feature name
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"\r'
  const [transcript] = parseGtf(gtf)
  expect(transcript!.featureType).toBe('transcript')
  const exon = featureData(transcript!.child_features![0]![0]!)
  expect(exon.transcript_id).toBe('t1')
})

test('synthesizes a transcript spanning its children when no transcript line exists', () => {
  const gtf = [
    'ctgA\ttest\tCDS\t100\t200\t.\t+\t0\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\tCDS\t400\t500\t.\t+\t0\tgene_id "g1"; transcript_id "t1";',
  ].join('\n')
  const [transcript] = parseGtf(gtf)
  expect(transcript!.featureType).toBe('transcript')
  expect(transcript!.start).toBe(100)
  expect(transcript!.end).toBe(500)
  expect(transcript!.child_features).toHaveLength(2)
  // a synthesized transcript must not inherit its first child's reading frame
  expect(transcript!.frame).toBeNull()
})

test('uses an explicit transcript line as the container for its children', () => {
  const gtf = [
    'ctgA\ttest\ttranscript\t100\t500\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\texon\t100\t200\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\texon\t400\t500\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\tgene\t100\t500\t.\t+\t.\tgene_id "g1";',
  ]
  const features = parseGtf(gtf.join('\n'))
  const transcript = features.find(f => f.featureType === 'transcript')
  expect(transcript!.child_features).toHaveLength(2)
  // the gene line has no transcript_id, so it stays a standalone top-level feature
  expect(features.filter(f => f.featureType === 'gene')).toHaveLength(1)
})
