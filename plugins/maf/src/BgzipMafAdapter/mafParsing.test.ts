import { makeRefChrFilter } from '../BgzipTaffyAdapter/taiIndex.ts'
import { parseMafBlocks } from './mafParsing.ts'

import type { ParsedAssemblyName } from '../util/parseAssemblyName.ts'

// `genome.chr` -> row/contig, the same split the tabix and bigMaf paths use.
const resolve = (token: string): ParsedAssemblyName | undefined => {
  const i = token.indexOf('.')
  return i === -1
    ? { assemblyName: token, chr: '' }
    : { assemblyName: token.slice(0, i), chr: token.slice(i + 1) }
}

const collect = (text: string) => [...parseMafBlocks(text, resolve)]

// Taffy and Cactus write tab-separated MAF; HPRC's 53 GB release-2 alignment is
// tab-separated. UCSC's is space-aligned. Both have to parse — splitting on
// spaces alone left the whole row in one field and every block silently
// vanished, which is a track that draws nothing rather than an error.
const tabbed = [
  '##maf\tversion=1',
  '',
  'a',
  's\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC',
  's\tHG002.1.chr1\t50\t10\t+\t1000\tACGTACGTAT',
  '',
].join('\n')

const spaced = [
  'a score=0',
  's hg38.chr1   100 10 + 248956422 ACGTACGTAC',
  's mm10.chr2    50 10 - 1000      ACGTACGTAT',
  '',
].join('\n')

test('parses a tab-separated block', () => {
  const [f] = collect(tabbed)
  expect(f).toBeDefined()
  expect([f!.start, f!.end]).toEqual([100, 110])
  expect(f!.seq).toBe('ACGTACGTAC')
  expect(Object.keys(f!.alignments).sort()).toEqual(['GRCh38', 'HG002'])
  expect(f!.alignments.HG002).toEqual({
    chr: '1.chr1',
    start: 50,
    seq: 'ACGTACGTAT',
    strand: 1,
    srcSize: 1000,
  })
})

test('parses a space-aligned block', () => {
  const [f] = collect(spaced)
  expect(f).toBeDefined()
  expect([f!.start, f!.end]).toEqual([100, 110])
  expect(f!.alignments.mm10?.strand).toBe(-1)
})

test('the first s line fixes the block span', () => {
  const [f] = collect(tabbed)
  // the reference row, not the widest or the last
  expect(f!.start).toBe(100)
  expect(f!.strand).toBe(1)
})

test('reads consecutive blocks', () => {
  const two = `${tabbed}a\ns\tGRCh38.chr1\t200\t5\t+\t248956422\tACGTA\n\n`
  const fs = collect(two)
  expect(fs.map(f => [f.start, f.end])).toEqual([
    [100, 110],
    [200, 205],
  ])
})

const withExtras = [
  'a',
  's\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC',
  's\tHG002.1.chr1\t50\t10\t+\t1000\tACGTACGTAT',
  'i\tHG002.1.chr1\tC\t0\tI\t12',
  'e\tHG003.1.chr1\t10\t5\t+\t1000\tI',
  'q\tHG002.1.chr1\t99999999',
  '# a comment',
  '',
].join('\n')

test('i/e/q lines and comments do not become aligned rows', () => {
  const [f] = collect(withExtras)
  expect(Object.keys(f!.alignments).sort()).toEqual(['GRCh38', 'HG002'])
})

// The same grammar bigMaf packs into its `mafBlock` field, so a `.maf.gz` gets
// the same rows out of it. These two used to be dropped here and read only on
// the bigMaf path, so the identical alignment lost its bridge lines and hover
// context purely by being published as MAF rather than as a bigMaf.
test('e lines become bridged rows', () => {
  const [f] = collect(withExtras)
  expect(f!.empties.HG003).toEqual({
    chr: '1.chr1',
    start: 10,
    size: 5,
    strand: 1,
    srcSize: 1000,
    status: 'I',
  })
  // and are not aligned rows
  expect(f!.alignments.HG003).toBeUndefined()
})

test('i lines become their own row context', () => {
  const [f] = collect(withExtras)
  expect(f!.alignments.HG002!.context).toEqual({
    leftStatus: 'C',
    leftCount: 0,
    rightStatus: 'I',
    rightCount: 12,
  })
  expect(f!.alignments.GRCh38!.context).toBeUndefined()
})

// A byte-range read cuts its last line mid-field. Such a row has no sequence, so
// it is dropped rather than given an `undefined` one — which reached the wire
// packer's `seq.length` and threw the whole region fetch away.
test('an s line missing its sequence field is dropped', () => {
  const short = [
    'a',
    's\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC',
    's\tHG002.1.chr1\t50\t10\t+\t1000',
    '',
  ].join('\n')
  const [f] = collect(short)
  expect(Object.keys(f!.alignments)).toEqual(['GRCh38'])
})

// A byte-range read almost always cuts its last block mid-row. Emitting it puts
// a short sequence at real coordinates — a plausible-looking alignment that is
// simply wrong — so an unterminated tail is dropped.
test('drops a block truncated by the byte range', () => {
  const cut = [
    'a',
    's\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC',
    '',
    'a',
    's\tGRCh38.chr1\t200\t10\t+\t248956422\tACGTAC', // no trailing newline
  ].join('\n')
  expect(collect(cut).map(f => f.start)).toEqual([100])
})

test('keeps a final block that ended cleanly', () => {
  const clean = 'a\ns\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC\n'
  expect(collect(clean).map(f => f.start)).toEqual([100])
})

// the slice begins at a .tai entry, which points at a block boundary, so the
// leading `a` is present; a stray row before one is not a block
test('ignores s lines before any a line', () => {
  const stray =
    's\tGRCh38.chr1\t1\t1\t+\t100\tA\n\na\ns\tGRCh38.chr1\t100\t10\t+\t248956422\tACGTACGTAC\n'
  expect(collect(stray).map(f => f.start)).toEqual([100])
})

test('rows the resolver rejects are dropped but still position the block', () => {
  const only = (token: string) => (t: string) =>
    t.startsWith(token) ? resolve(t) : undefined
  const fs = [...parseMafBlocks(tabbed, only('HG002'))]
  // GRCh38 is filtered out of the sample set yet still fixes the extent
  expect([fs[0]!.start, fs[0]!.end]).toEqual([100, 110])
  expect(Object.keys(fs[0]!.alignments)).toEqual(['HG002'])
})

test('an empty slice yields nothing', () => {
  expect(collect('')).toEqual([])
  expect(collect('\n\n')).toEqual([])
})

// The reference row's own source token, carried so the adapter can tell a block
// of the queried chromosome from one the over-generous read pulled in from the
// next. See `makeRefChrFilter`.
test('carries the reference row source token', () => {
  expect(collect(tabbed).map(f => f.refSrc)).toEqual(['GRCh38.chr1'])
})

// A `-` reference row is spec-legal and states its start against the reverse
// complement of the source, so `1000` on a 2000bp source means forward
// [990, 1000). Placing it unflipped put the block a whole chromosome away from
// where it belongs, and nothing downstream can correct a block's `start`.
describe('a minus-strand reference row', () => {
  const minusRef = [
    'a',
    's\thg38.chr1\t1000\t10\t-\t2000\tACGTACGTAC',
    's\tmm10.chr2\t50\t10\t+\t500\tACGTACGTAT',
    '',
  ].join('\n')

  test('places the block on the forward strand', () => {
    const [f] = collect(minusRef)
    expect([f!.start, f!.end]).toEqual([990, 1000])
    expect(f!.strand).toBe(1)
  })

  // The coordinate alone would not be a fix: the columns would then run
  // backwards across a correctly placed span, so every base would be at the
  // wrong position within the block.
  test('reverse-complements every row, reference included', () => {
    const [f] = collect(minusRef)
    expect(f!.seq).toBe('GTACGTACGT')
    expect(f!.alignments.hg38!.seq).toBe('GTACGTACGT')
    expect(f!.alignments.mm10!.seq).toBe('ATACGTACGT')
  })

  test('re-expresses each row through its own srcSize and strand', () => {
    const [f] = collect(minusRef)
    expect(f!.alignments.hg38).toMatchObject({ start: 990, strand: 1 })
    expect(f!.alignments.mm10).toMatchObject({ start: 440, strand: -1 })
  })

  test('swaps each row left/right context, which the flip exchanges', () => {
    const [f] = collect(
      [
        'a',
        's\thg38.chr1\t1000\t10\t-\t2000\tACGTACGTAC',
        's\tmm10.chr2\t50\t10\t+\t500\tACGTACGTAT',
        'i\tmm10.chr2\tC\t0\tI\t12',
        '',
      ].join('\n'),
    )
    expect(f!.alignments.mm10!.context).toEqual({
      leftStatus: 'I',
      leftCount: 12,
      rightStatus: 'C',
      rightCount: 0,
    })
  })

  test('re-expresses bridged rows too', () => {
    const [f] = collect(
      [
        'a',
        's\thg38.chr1\t1000\t10\t-\t2000\tACGTACGTAC',
        'e\tmm10.chr2\t10\t5\t+\t500\tI',
        '',
      ].join('\n'),
    )
    expect(f!.empties.mm10).toMatchObject({ start: 485, strand: -1 })
  })

  // A row shorter than the block is the realistic shape, and its own `start`
  // has to re-express through its aligned base count, not the block's width.
  test('a gapped row re-expresses through its own aligned length', () => {
    const [f] = collect(
      [
        'a',
        's\thg38.chr1\t1000\t10\t-\t2000\tACGTACGTAC',
        's\tmm10.chr2\t50\t6\t+\t500\tAC----GTAT',
        '',
      ].join('\n'),
    )
    // 6 aligned bases (which is what its own `size` field states), so
    // 500 - 50 - 6
    expect(f!.alignments.mm10).toMatchObject({
      start: 444,
      strand: -1,
      seq: 'ATAC----GT',
    })
  })

  test('a plus-strand reference row is left exactly as it was', () => {
    const [f] = collect(tabbed)
    expect([f!.start, f!.end]).toEqual([100, 110])
    expect(f!.seq).toBe('ACGTACGTAC')
    expect(f!.alignments.HG002).toMatchObject({ start: 50, strand: 1 })
  })
})

// The composite the adapter applies. `queryBlockSpan` bounds a past-the-end
// read at the *next chromosome's* first block and the caller adds a 64KB
// cushion, so blocks of the following chromosome are decoded by design — and
// they overlap the query numerically, because coordinates restart per
// chromosome. Filtering on the span alone emitted them at real positions on the
// queried scaffold.
test('the adapter filter keeps only the queried chromosome', () => {
  const twoChrs = [
    'a',
    's\thg38.chr1\t100\t10\t+\t248956422\tACGTACGTAC',
    '',
    'a',
    's\thg38.chr2\t100\t10\t+\t242193529\tTTTTTTTTTT',
    '',
  ].join('\n')
  const onChr1 = makeRefChrFilter('chr1')
  const query = { start: 0, end: 1000 }
  const kept = collect(twoChrs).filter(
    f => f.end > query.start && f.start < query.end && onChr1(f.refSrc),
  )
  expect(kept.map(f => f.refSrc)).toEqual(['hg38.chr1'])
})
