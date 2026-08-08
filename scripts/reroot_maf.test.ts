// reroot_maf.py is the densest of the helpers a reader downloads: it re-roots
// every block on one reference, reverse-complements the ones whose reference
// runs backwards, splits a collapsed repeat into one block per copy, and crops
// smoothxg's block padding away. Each of those is a claim its docstring records
// measurements for, and none of them was executable.
//
// The invariants below are that docstring's own, so a future change either
// keeps them or has to argue with a failing test rather than with prose.
import { readFileSync } from 'node:fs'

import { assertPython3, fixture, runPython } from './pythonHelperScript.ts'

const REF = 'K12#1#chr'

interface Row {
  name: string
  start: number
  size: number
  strand: string
  srcSize: number
  seq: string
}

// Blocks are deliberately out of reference order in the input, so the sort the
// interval index depends on is doing something here.
const INPUT = `##maf version=1

a
s K12#1#chr 100 5 + 4641652 ACGTA
s Sakai#1#chr 200 5 + 5498578 ACGTT

a
s Sakai#1#chr 300 4 + 5498578 ACGT
s CFT073#1#chr 400 4 + 5231428 ACGT

a
s K12#1#chr 10 4 - 4641652 AACG
s Sakai#1#chr 20 4 + 5498578 TTTT

a
s K12#1#chr 900 4 + 4641652 ACGT
s K12#1#chr 50 4 + 4641652 ACGA
s Sakai#1#chr 700 4 + 5498578 ACGC

a
s K12#1#chr 6000 4 + 4641652 ACGT
s Sakai#1#chr 7000 2 + 5498578 ACGT
s IAI39#1#chr 8000 2 - 4000000 ACGT
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
  const at = fixture({ 'in.maf': INPUT })
  const run = runPython('reroot_maf.py', [at('in.maf'), at('out.maf'), REF])
  expect(run.status).toBe(0)
  stderr = run.stderr
  blocks = parseMaf(readFileSync(at('out.maf'), 'utf8'))
})

test('a block without the reference is dropped', () => {
  const names = blocks.flat().map(r => r.name)
  expect(names).not.toContain('CFT073.chr')
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
    'Sakai.chr',
  ])
})

test('blocks come out sorted by reference start', () => {
  const starts = blocks.map(b => b[0]!.start)
  expect(starts).toEqual([...starts].sort((a, b) => a - b))
  expect(starts).toEqual([50, 100, 900, 6000, 4641638])
})

test('no block overlaps its predecessor on the reference', () => {
  // The property the script's own closing counter watches: the crop keeps each
  // block to its reference row's declared interval, and those partition the
  // reference.
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]![0]!
    expect(blocks[i]![0]!.start).toBeGreaterThanOrEqual(prev.start + prev.size)
  }
  expect(stderr).toMatch(/0 blocks overlap their predecessor/)
})

test('a reference row on the minus strand flips the whole block', () => {
  const block = blocks.find(b => b[0]!.start === 4641638)!
  // srcSize - start - size, and the reference always ends up '+'
  expect(block[0]).toMatchObject({
    name: 'K12.chr',
    start: 4641638,
    size: 4,
    strand: '+',
    seq: 'CGTT',
  })
  // every other row flips with it, including its strand
  expect(block[1]).toMatchObject({
    name: 'Sakai.chr',
    start: 5498554,
    strand: '-',
    seq: 'AAAA',
  })
})

test('a collapsed repeat becomes one block per reference copy', () => {
  // Both copies came from one input block. Each anchors its own block, so a
  // region query can reach the surplus copy at all.
  const copies = blocks.filter(b => [50, 900].includes(b[0]!.start))
  expect(copies).toHaveLength(2)
  expect(copies.map(b => b[0]!.seq)).toEqual(['ACGA', 'ACGT'])
  // the non-reference rows are repeated into each copy
  for (const block of copies) {
    expect(block[1]).toMatchObject({ name: 'Sakai.chr', start: 700 })
  }
  expect(stderr).toMatch(/1 of 4 input blocks carried several .* rows/)
})

test('smoothxg block padding is blanked from the end the row’s strand puts it on', () => {
  const block = blocks.find(b => b[0]!.start === 6000)!
  // The pad follows the declared interval in the row's OWN direction, so a
  // plus-strand row keeps its leading bases and a minus-strand row its
  // trailing ones. Getting this backwards draws the phantom insertion at the
  // other edge instead of removing it.
  expect(block[1]).toMatchObject({
    name: 'Sakai.chr',
    strand: '+',
    seq: 'AC--',
    size: 2,
  })
  expect(block[2]).toMatchObject({
    name: 'IAI39.chr',
    strand: '-',
    seq: '--GT',
    size: 2,
  })
  // start is untouched: the pad runs outward from the declared interval, so
  // blanking it leaves the row starting where it always said it did
  expect(block[1]!.start).toBe(7000)
  expect(block[2]!.start).toBe(8000)
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
