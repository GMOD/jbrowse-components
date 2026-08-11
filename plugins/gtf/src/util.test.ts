import {
  aggregateGtfFeatures,
  featureData,
  parseGtf,
  parseGtfToFeatures,
} from './util.ts'

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
  const exon = featureData(parse(gtf)[0]!.child_features![0]!)
  expect(exon.gene_id).toBe('ENSG01')
  expect(exon.tag).toEqual(['basic', 'CCDS'])
})

test('keeps a comma inside an attribute value intact', () => {
  // GTF expresses multiple values via repeated keys, not comma separation, so a
  // comma inside a quoted value must not split it
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"; note "a, b";'
  const [transcript] = parse(gtf)
  const exon = featureData(transcript!.child_features![0]!)
  expect(exon.note).toBe('a, b')
})

test('strips CRLF carriage returns so the final attribute is not corrupted', () => {
  // guards the parser itself, not either adapter: today's line sources both
  // trim the CRLF terminator upstream, but a \r that does get through lands
  // inside transcript_id (on a line with no trailing ';'), which drives both
  // grouping and the feature name
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"\r'
  const [transcript] = parse(gtf)
  expect(transcript!.featureType).toBe('transcript')
  const exon = featureData(transcript!.child_features![0]!)
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
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 300,
  })
  expect(out.map(f => f.uniqueId)).toEqual(['in'])
})

test('keeps distinct genes that share a gene_name apart', () => {
  // a GENCODE chromosome carries hundreds of separate genes named U6/Y_RNA;
  // grouping on the name alone fused them into one feature spanning the whole
  // chromosome, so the gene_id has to split them back apart
  const gtf = [
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; gene_name "U6";',
    'chr1\ttest\texon\t10000000\t10000100\t.\t+\t.\tgene_id "G2"; transcript_id "t2"; gene_name "U6";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: Number.MAX_SAFE_INTEGER,
  })
  expect(out).toHaveLength(2)
  // both keep the shared display name, but span only their own locus
  expect(out.map(f => f.name)).toEqual(['U6', 'U6'])
  expect(out.map(f => [f.start, f.end])).toEqual([
    [99, 200],
    [9999999, 10000100],
  ])
  // ids are keyed on the gene_id, so the two never collide
  expect(new Set(out.map(f => f.uniqueId)).size).toBe(2)
})

test('still merges the transcripts that really do share a gene', () => {
  const gtf = [
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; gene_name "ABC";',
    'chr1\ttest\texon\t300\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t2"; gene_name "ABC";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: Number.MAX_SAFE_INTEGER,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.name).toBe('ABC')
  expect(out[0]!.subfeatures).toHaveLength(2)
})

test('builds a gene from a file with gene_id but no gene_name', () => {
  // UCSC's genePredToGtf emits `gene_id "TP53"; transcript_id "NM_000546";` and
  // nothing more, as does AUGUSTUS. Keying only on the default aggregate field
  // left these with no gene model at all — every transcript passed through bare
  const gtf = [
    'chr17\thg19_refGene\texon\t100\t200\t.\t-\t.\tgene_id "TP53"; transcript_id "NM_000546";',
    'chr17\thg19_refGene\texon\t300\t400\t.\t-\t.\tgene_id "TP53"; transcript_id "NM_001126112";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr17',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: Number.MAX_SAFE_INTEGER,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.type).toBe('gene')
  // no better label available, so the gene_id doubles as the display name
  expect(out[0]!.name).toBe('TP53')
  expect(out[0]!.subfeatures).toHaveLength(2)
  expect([out[0]!.start, out[0]!.end]).toEqual([99, 400])
})

test('a transcript carrying the aggregate value names a gene the first left unnamed', () => {
  const gtf = [
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1";',
    'chr1\ttest\texon\t300\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t2"; gene_name "ABC";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: Number.MAX_SAFE_INTEGER,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.name).toBe('ABC')
})

test('a synthesized transcript carries the attributes its children agree on', () => {
  // exon_number differs per line and must not surface on the transcript, while
  // an arbitrary transcript-level tag must — a fixed whitelist of three names
  // meant a custom aggregateField (StringTie's ref_gene_name here) never
  // aggregated for files with no explicit transcript line
  const gtf = [
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; ref_gene_name "ABC"; exon_number "1";',
    'chr1\ttest\texon\t300\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; ref_gene_name "ABC"; exon_number "2";',
  ].join('\n')
  const [transcript] = parse(gtf)
  const feat = featureData(transcript!)
  expect(feat.ref_gene_name).toBe('ABC')
  expect(feat.gene_id).toBe('G1')
  expect(feat.exon_number).toBeUndefined()
})

test('an explicit transcript line keeps its own attributes', () => {
  // narrowing applies only to synthesized transcripts: an explicit line is
  // authoritative even where its children disagree with it
  const gtf = [
    'chr1\ttest\ttranscript\t100\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; tsl "1";',
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; exon_number "1";',
  ].join('\n')
  const [transcript] = parse(gtf)
  expect(featureData(transcript!).tsl).toBe('1')
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

test('keeps a semicolon inside a quoted attribute value intact', () => {
  // the ';' entry separator can also occur inside a quoted value, where
  // splitting on it truncated the value and dropped the remainder silently
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"; note "a; b"; tag "basic";'
  const exon = featureData(parse(gtf)[0]!.child_features![0]!)
  expect(exon.note).toBe('a; b')
  // the entry after the rejoined one is still read
  expect(exon.tag).toBe('basic')
})

test('a malformed line cannot take its transcript down with it', () => {
  // Number('') is NaN, and Math.min/Math.max against NaN spreads it to the
  // transcript spanning the line; a NaN-bounded transcript then fails every
  // intersection test, so the truncated line used to remove the whole gene
  const gtf = [
    'chr1\ttest\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1";',
    'chr1\ttest\texon\t.\t.\t.\t+\t.\tgene_id "G1"; transcript_id "t1";',
    'chr1\ttest\texon',
  ].join('\n')
  const [transcript] = parse(gtf)
  expect([transcript!.start, transcript!.end]).toEqual([100, 200])
  expect(transcript!.child_features).toHaveLength(1)
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 1000,
  })
  expect(out).toHaveLength(1)
  expect([out[0]!.start, out[0]!.end]).toEqual([99, 200])
})

// The attribute column is scanned by index rather than split-then-trim-then-
// regex. These pin the edges that scanner has to get right, each of which the
// old implementation got from a library call that is no longer being made:
// `trim()` on both the entry and the value, and a `/^"|"$/g` replace that
// stripped a leading and a trailing quote independently.
test.each([
  ['bare values need no quotes', 'gene_id "g1"; level 2;', 'level', '2'],
  [
    'an empty quoted value is dropped',
    'gene_id "g1"; note "";',
    'note',
    undefined,
  ],
  // an entry whose quote is never closed is the case the rejoin rule exists
  // for, so it swallows the ';' that follows and everything up to the next one
  // — here, the end of the column. Malformed input either way; pinned because
  // it is the one place the entry boundary is not the ';' it looks like
  [
    'an unclosed quote swallows the separator',
    'gene_id "g1"; note "x;',
    'note',
    'x;',
  ],
  [
    'so does a value that only closes one',
    'gene_id "g1"; note x";',
    'note',
    'x";',
  ],
  [
    'padding around an entry is trimmed',
    'gene_id "g1";    note   "x"   ;',
    'note',
    'x',
  ],
  [
    'an entry with no space is not an attribute',
    'gene_id "g1"; note;',
    'note',
    undefined,
  ],
  // the key/value split has always been on a literal space, so a tab between
  // them leaves the pair unrecognized rather than silently splitting there
  [
    'a tab does not separate key from value',
    'gene_id "g1"; note\tx;',
    'note',
    undefined,
  ],
  [
    'a quote inside a value is kept',
    'gene_id "g1"; note "a"b";',
    'note',
    'a"b',
  ],
  [
    'a trailing entry needs no semicolon',
    'gene_id "g1"; note "x"',
    'note',
    'x',
  ],
])('%s', (_name, attrs, key, expected) => {
  const feat = parse(`ctgA\ttest\tgene\t1\t100\t.\t+\t.\t${attrs}`)[0]!
  expect(featureData(feat)[key]).toBe(expected)
})

test('an attribute named subfeatures cannot replace the child array', () => {
  const gtf =
    'ctgA\ttest\texon\t1\t100\t.\t+\t.\tgene_id "g1"; transcript_id "t1"; subfeatures "x";'
  const exon = featureData(parse(gtf)[0]!.child_features![0]!)
  // the exon has no children of its own, so nothing would overwrite a string
  // left here, and every consumer of subfeatures expects an array
  expect(exon.subfeatures).toBeUndefined()
  expect(exon.subfeatures2).toBe('x')
})

test('keeps an explicit gene line that no synthesized gene supersedes', () => {
  // a file of nothing but gene rows has no transcript to synthesize a gene
  // from, so dropping every explicit gene line rendered it as an empty track
  const gtf = [
    'chr1\ttest\tgene\t100\t200\t.\t+\t.\tgene_id "G1"; gene_name "ABC";',
    'chr1\ttest\tgene\t300\t400\t.\t+\t.\tgene_id "G2";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 1000,
  })
  expect(out.map(f => f.type)).toEqual(['gene', 'gene'])
  // named by gene_name where there is one, else by the gene_id
  expect(out.map(f => f.name)).toEqual(['ABC', 'G2'])
})

test('drops an explicit gene line once its transcripts build the same gene', () => {
  const gtf = [
    'chr1\tHAVANA\tgene\t100\t400\t.\t+\t.\tgene_id "G1"; gene_name "ABC";',
    'chr1\tHAVANA\texon\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; gene_name "ABC";',
    'chr1\tHAVANA\texon\t300\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t2"; gene_name "ABC";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 1000,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.subfeatures).toHaveLength(2)
})

test('a childless transcript with a gene_id still builds a gene', () => {
  // a transcript-only GTF (no exon/CDS rows) used to render nothing: every
  // transcript was childless, and childless transcripts were dropped wholesale
  const gtf = [
    'chr1\ttest\ttranscript\t100\t200\t.\t+\t.\tgene_id "G1"; transcript_id "t1"; gene_name "ABC";',
    'chr1\ttest\ttranscript\t300\t400\t.\t+\t.\tgene_id "G1"; transcript_id "t2"; gene_name "ABC";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr1',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 1000,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.name).toBe('ABC')
  expect(out[0]!.subfeatures).toHaveLength(2)
})

test('still drops a bare transcript line that has nothing to group on', () => {
  // AUGUSTUS writes `g1` / `g1.t1` in column 9, which parse to no attributes at
  // all; the real model is in the exon lines below, so the two container lines
  // must not surface as features of their own
  const gtf = [
    'chr17\tAUGUSTUS\tgene\t100\t400\t0.42\t-\t.\tg1',
    'chr17\tAUGUSTUS\ttranscript\t100\t400\t0.42\t-\t.\tg1.t1',
    'chr17\tAUGUSTUS\texon\t100\t200\t.\t-\t.\ttranscript_id "g1.t1"; gene_id "g1";',
    'chr17\tAUGUSTUS\texon\t300\t400\t.\t-\t.\ttranscript_id "g1.t1"; gene_id "g1";',
  ].join('\n')
  const out = aggregateGtfFeatures({
    feats: parseGtfToFeatures(
      gtf.split('\n').map(line => ({ line })),
      (_r, i) => `id-${i}`,
    ),
    aggregateField: 'gene_name',
    refName: 'chr17',
    idPrefix: 'test',
    regionStart: 0,
    regionEnd: 1000,
  })
  expect(out).toHaveLength(1)
  expect(out[0]!.name).toBe('g1')
  expect(out[0]!.subfeatures).toHaveLength(1)
})
