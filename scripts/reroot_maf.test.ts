// reroot_maf.py is the densest of the helpers a reader downloads: it re-roots
// every block on one reference, reverse-complements the ones whose reference
// runs backwards, splits a collapsed repeat into one block per copy, and blanks
// smoothxg's block padding by matching each row against its genome. Each of
// those is a claim its docstring records measurements for, and none of them was
// executable.
//
// The invariants below are that docstring's own, so a future change either
// keeps them or has to argue with a failing test rather than with prose.
import { readFileSync } from 'node:fs'

import { assertPython3, fixture, runPython } from './pythonHelperScript.ts'

const REF = 'K12#1#chr'
const LENGTH = 1000

interface Row {
  name: string
  start: number
  size: number
  strand: string
  srcSize: number
  seq: string
}

// Each strain is LENGTH bases of N with the bases its rows declare written in,
// so a row's own bases are findable and a pad, which is not N, never is.
function genome(placed: Record<number, string>) {
  const chars = new Array<string>(LENGTH).fill('N')
  for (const [at, bases] of Object.entries(placed)) {
    chars.splice(+at, bases.length, ...bases.split(''))
  }
  return chars.join('')
}

const GENOMES = {
  'K12#1#chr': genome({
    50: 'ACGA',
    100: 'ACGTA',
    600: 'ACGT',
    700: 'AC',
    800: 'ACGT',
    840: 'TT',
    900: 'ACGT',
    986: 'CGTT',
  }),
  'Sakai#1#chr': genome({
    20: 'TTTT',
    200: 'ACGTT',
    500: 'GT',
    700: 'ACGC',
    800: 'GGAC',
    900: 'ACGT',
  }),
  'IAI39#1#chr': genome({ 50: 'GG', 698: 'GT' }),
  'NCTC86#1#chr': genome({ 100: 'AC' }),
  'CFT073#1#chr': genome({ 50: 'TTT' }),
}

// Blocks are deliberately out of reference order in the input, so the sort the
// interval index depends on is doing something here.
const INPUT = `##maf version=1

a
s K12#1#chr 100 5 + ${LENGTH} ACGTA
s Sakai#1#chr 200 5 + ${LENGTH} ACGTT

a
s Sakai#1#chr 300 4 + ${LENGTH} ACGT
s CFT073#1#chr 400 4 + ${LENGTH} ACGT

a
s K12#1#chr 10 4 - ${LENGTH} AACG
s Sakai#1#chr 20 4 + ${LENGTH} TTTT

a
s K12#1#chr 900 4 + ${LENGTH} ACGT
s K12#1#chr 50 4 + ${LENGTH} ACGA
s Sakai#1#chr 700 4 + ${LENGTH} ACGC

a
s K12#1#chr 600 4 + ${LENGTH} ACGT
s Sakai#1#chr 500 2 + ${LENGTH} ACGT
s IAI39#1#chr 300 2 - ${LENGTH} ACGT
s NCTC86#1#chr 100 2 + ${LENGTH} TACG
s CFT073#1#chr 50 3 + ${LENGTH} GGG-

a
s K12#1#chr 700 2 + ${LENGTH} --AC
s Sakai#1#chr 800 4 + ${LENGTH} GGAC

a
s K12#1#chr 800 4 + ${LENGTH} ----ACGT
s Sakai#1#chr 900 4 + ${LENGTH} ACGTACGT
s IAI39#1#chr 50 2 + ${LENGTH} GGGGGG--

a
s K12#1#chr 840 2 + ${LENGTH} TTTT
s NCTC86#1#chr 100 2 + ${LENGTH} --AC
`

function parseMaf(text: string): Row[][] {
  const blocks: Row[][] = []
  for (const line of text.split('\n')) {
    if (line.startsWith('a')) {
      blocks.push([])
    } else if (line.startsWith('s')) {
      const [, name, start, size, strand, srcSize, seq] = line.split(/\s+/)
      blocks.at(-1)!.push({
        name: name!,
        start: +start!,
        size: +size!,
        strand: strand!,
        srcSize: +srcSize!,
        seq: seq!,
      })
    }
  }
  return blocks
}

let blocks: Row[][]
let stderr: string

beforeAll(() => {
  assertPython3()
  const fasta = Object.entries(GENOMES)
    .map(([name, seq]) => `>${name}\n${seq}\n`)
    .join('')
  const at = fixture({ 'in.maf': INPUT, 'genomes.fa': fasta })
  const run = runPython('reroot_maf.py', [
    at('in.maf'),
    at('out.maf'),
    at('genomes.fa'),
    REF,
  ])
  expect(run.status).toBe(0)
  stderr = run.stderr
  blocks = parseMaf(readFileSync(at('out.maf'), 'utf8'))
})

const blockAt = (start: number) => blocks.find(b => b[0]!.start === start)!

test('a block without the reference is dropped', () => {
  const sakai = blocks.flat().filter(r => r.name === 'Sakai.chr')
  expect(sakai.map(r => r.start)).not.toContain(300)
})

test('every block is rooted on the reference, which is what row 0 means', () => {
  // A block is found through row 0's interval alone, by a tabix BED line or a
  // taffy .tai record, so this is the file's whole reason to exist.
  expect(blocks.map(b => b[0]!.name)).toEqual(blocks.map(() => 'K12.chr'))
})

test('exactly one reference row per block', () => {
  // Keeping the other copies would leave the block's interval naming one copy
  // while its reference sequence came from another, since the MAF adapters key
  // alignments by assembly name and the last row wins.
  for (const block of blocks) {
    expect(block.filter(r => r.name === 'K12.chr')).toHaveLength(1)
  }
})

test('PanSN names become sample.contig, derived rather than substituted', () => {
  // The MAF display splits a row's species off on the first '.', and the
  // reference path is an argument, so a graph on haplotype 0 or with contigs
  // not spelled `chr` has to rename too.
  expect([...new Set(blocks.flat().map(r => r.name))].sort()).toEqual([
    'IAI39.chr',
    'K12.chr',
    'NCTC86.chr',
    'Sakai.chr',
  ])
})

test('blocks come out sorted by reference start', () => {
  const starts = blocks.map(b => b[0]!.start)
  expect(starts).toEqual([50, 100, 600, 700, 800, 900, 986])
})

test('no block overlaps its predecessor on the reference', () => {
  // The property the script's own closing counter watches: each block covers
  // its reference row's declared interval, and those partition the reference.
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]![0]!
    expect(blocks[i]![0]!.start).toBeGreaterThanOrEqual(prev.start + prev.size)
  }
  expect(stderr).toMatch(/0 blocks overlap their predecessor/)
})

test('a reference row on the minus strand flips the whole block', () => {
  const block = blockAt(986)
  // srcSize - start - size, and the reference always ends up '+'
  expect(block[0]).toMatchObject({
    name: 'K12.chr',
    start: 986,
    size: 4,
    strand: '+',
    seq: 'CGTT',
  })
  // every other row flips with it, including its strand
  expect(block[1]).toMatchObject({
    name: 'Sakai.chr',
    start: 976,
    strand: '-',
    seq: 'AAAA',
  })
})

test('a collapsed repeat becomes one block per reference copy', () => {
  // Both copies came from one input block. Each anchors its own block, so a
  // region query can reach the surplus copy at all.
  const copies = [blockAt(50), blockAt(900)]
  expect(copies.map(b => b[0]!.seq)).toEqual(['ACGA', 'ACGT'])
  // the non-reference rows are repeated into each copy
  for (const block of copies) {
    expect(block[1]).toMatchObject({ name: 'Sakai.chr', start: 700 })
  }
  expect(stderr).toMatch(/1 of 7 input blocks carried several .* rows/)
})

test('smoothxg padding is blanked wherever the genome places the row', () => {
  // The pad sits on the left, the right or both ends of a row, so the
  // genome is the only thing that says which bases are the row's own.
  const block = blockAt(600)
  const byName = Object.fromEntries(block.map(r => [r.name, r]))
  expect(byName['Sakai.chr']).toMatchObject({
    start: 500,
    size: 2,
    seq: '--GT',
  })
  expect(byName['IAI39.chr']).toMatchObject({
    start: 300,
    size: 2,
    strand: '-',
    seq: 'AC--',
  })
  expect(byName['NCTC86.chr']).toMatchObject({
    start: 100,
    size: 2,
    seq: '-AC-',
  })
})

test('a row that does not carry its declared bases is dropped', () => {
  // CFT073's row declares 50..53, which holds TTT; GGG is not its sequence
  expect(blockAt(600).map(r => r.name)).not.toContain('CFT073.chr')
  // counted over blocks that hold the reference, the only ones emitted
  expect(stderr).toMatch(/1 input rows did not carry their declared bases/)
})

test('a row holding its declared bases twice goes where it agrees with the block', () => {
  // ACGTACGT holds Sakai's ACGT at 0 and at 4; only 4 lines up with K12's
  // ACGT, and the first match would have put Sakai's bases over K12's gap
  expect(blockAt(800)[1]).toMatchObject({
    name: 'Sakai.chr',
    start: 900,
    seq: 'ACGT',
  })
})

test('a row whose candidate offsets tie is dropped, the reference with its block', () => {
  // IAI39's GG fits at five offsets and no placed row agrees with any of them
  expect(blockAt(800).map(r => r.name)).not.toContain('IAI39.chr')
  // K12's TT fits at three, none agreeing either: no block rather than a
  // guessed one, and the gap is reported
  expect(blocks.map(b => b[0]!.start)).not.toContain(840)
  expect(stderr).toMatch(
    /3 input rows held them at several offsets: 1 placed by agreement with the block, 2 dropped as ties/,
  )
})

test('gaps in reference coverage are counted and measured', () => {
  // the fixture's K12 blocks cover 27 of its 1000 bases, in 7 runs
  expect(stderr).toMatch(/8 gaps \(973 bp\) in K12#1#chr coverage/)
})

test('cropping a row to the reference span moves its start past what it cut', () => {
  // Sakai's GG sit where the reference is gap, so the crop keeps AC and the
  // row now starts two bases later
  expect(blockAt(700)[1]).toMatchObject({
    name: 'Sakai.chr',
    start: 802,
    size: 2,
    seq: 'AC',
  })
})

test('every emitted row is its genome at its declared start', () => {
  const comp: Record<string, string> = { A: 'T', C: 'G', G: 'C', T: 'A' }
  for (const block of blocks) {
    for (const row of block) {
      const seq = GENOMES[row.name.replace('.', '#1#') as keyof typeof GENOMES]
      const bases = row.seq.replaceAll('-', '')
      const want =
        row.strand === '+'
          ? seq.slice(row.start, row.start + row.size)
          : seq
              .slice(LENGTH - row.start - row.size, LENGTH - row.start)
              .split('')
              .reverse()
              .map(c => comp[c] ?? c)
              .join('')
      expect([row.name, row.start, bases]).toEqual([row.name, row.start, want])
    }
  }
})

test('every emitted row declares exactly its own non-gap count', () => {
  // The MAF spec defines `size` that way, and the input's is what disagrees.
  for (const block of blocks) {
    for (const row of block) {
      expect([row.name, row.size]).toEqual([
        row.name,
        row.seq.replaceAll('-', '').length,
      ])
    }
  }
})

test('every row in a block spans the same number of columns', () => {
  for (const block of blocks) {
    const widths = new Set(block.map(r => r.seq.length))
    expect(widths.size).toBe(1)
  }
})
