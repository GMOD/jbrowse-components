import { aggregateGtfFeatures, featureData, parseGtf } from './util.ts'

import type { FeatureLoc } from './util.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// parse GTF text into top-level features, dropping the record pairing that only
// the tabix adapter (byte-offset ids) needs
function parse(gtf: string): FeatureLoc[] {
  return parseGtf(gtf.split('\n').map(line => ({ line }))).map(p => p.feature)
}

test('strips GTF quotes and unwraps single- vs multi-value attributes alike', () => {
  // GTF expresses multiple values via repeated keys (tag ...; tag ...)
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "ENSG01"; transcript_id "t1"; tag "basic"; tag "CCDS";'
  const exon = featureData(parse(gtf)[0]!.child_features![0]![0]!)
  expect(exon.gene_id).toBe('ENSG01')
  expect(exon.tag).toEqual(['basic', 'CCDS'])
})

test('keeps a comma inside an attribute value intact', () => {
  // GTF expresses multiple values via repeated keys, not comma separation, so a
  // comma inside a quoted value must not split it
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"; note "a, b";'
  const [transcript] = parse(gtf)
  const exon = featureData(transcript!.child_features![0]![0]!)
  expect(exon.note).toBe('a, b')
})

test('strips CRLF carriage returns so the final attribute is not corrupted', () => {
  // tabix-read CRLF lines carry a trailing \r; without a trailing ';' it lands
  // inside transcript_id, which drives both grouping and the feature name
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"\r'
  const [transcript] = parse(gtf)
  expect(transcript!.featureType).toBe('transcript')
  const exon = featureData(transcript!.child_features![0]![0]!)
  expect(exon.transcript_id).toBe('t1')
})

test('synthesizes a transcript spanning its children when no transcript line exists', () => {
  const gtf = [
    'ctgA\ttest\tCDS\t100\t200\t.\t+\t0\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\tCDS\t400\t500\t.\t+\t0\tgene_id "g1"; transcript_id "t1";',
  ].join('\n')
  const [transcript] = parse(gtf)
  expect(transcript!.featureType).toBe('transcript')
  expect(transcript!.start).toBe(100)
  expect(transcript!.end).toBe(500)
  expect(transcript!.child_features).toHaveLength(2)
  // a synthesized transcript must not inherit its first child's reading frame
  expect(transcript!.frame).toBeNull()
})

test('clips passthrough features (no aggregate field) to the query region', () => {
  // a redispatch fetches a wider range than the view; a feature lacking the
  // aggregate field must still be dropped if it falls outside the query, else
  // it leaks in from the expanded fetch
  const exon = (id: string, start: number, end: number) => ({
    uniqueId: id,
    refName: 'ctgA',
    type: 'exon',
    start,
    end,
  })
  const feats: SimpleFeatureSerialized[] = [
    {
      uniqueId: 'in',
      refName: 'ctgA',
      type: 'transcript',
      start: 100,
      end: 200,
      subfeatures: [exon('in-e', 100, 200)],
    },
    {
      uniqueId: 'out',
      refName: 'ctgA',
      type: 'transcript',
      start: 900,
      end: 999,
      subfeatures: [exon('out-e', 900, 999)],
    },
  ]
  const out = aggregateGtfFeatures({
    feats,
    aggregateField: 'gene_name',
    refName: 'ctgA',
    regionStart: 0,
    regionEnd: 300,
  })
  expect(out.map(f => f.uniqueId)).toEqual(['in'])
})

test('uses an explicit transcript line as the container for its children', () => {
  const gtf = [
    'ctgA\ttest\ttranscript\t100\t500\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\texon\t100\t200\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\texon\t400\t500\t.\t+\t.\tgene_id "g1"; transcript_id "t1";',
    'ctgA\ttest\tgene\t100\t500\t.\t+\t.\tgene_id "g1";',
  ]
  const features = parse(gtf.join('\n'))
  const transcript = features.find(f => f.featureType === 'transcript')
  expect(transcript!.child_features).toHaveLength(2)
  // the gene line has no transcript_id, so it stays a standalone top-level feature
  expect(features.filter(f => f.featureType === 'gene')).toHaveLength(1)
})
