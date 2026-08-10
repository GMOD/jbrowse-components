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
