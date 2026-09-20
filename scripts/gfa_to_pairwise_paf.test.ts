// gfa_to_pairwise_paf.py is the GFA route of build_hprc_multiway_synteny.sh,
// and what nothing downstream would catch is the same as for its MAF sibling:
// a flipped chain's coordinates and CIGAR direction, and where a chain breaks.
// So the graph is small enough to work every row out by hand.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { assertPython3, fixture, tsvRows } from './pythonHelperScript.ts'

// GRCh38 chrA walks 1 2 4 5 6 7 8 9 8 10 (59 bp; node 8 twice, at 33 and 49).
// HG01109 ctgA arrives as two W pieces: the first takes the SNP allele 3 for 2,
// skips 5, inserts 11, and reaches 8 the first time; the second starts at
// offset 50 on 9 and reaches 8 the second time. HG01123 ctgB traverses 7 and 5
// backwards, skipping 6 between them. HG00097 ctgC is one shared node.
const NODES = [
  ['1', 'ACGTACGTAC'],
  ['2', 'G'],
  ['3', 'T'],
  ['4', 'CCCCC'],
  ['5', 'AAA'],
  ['6', 'GGGGGGGG'],
  ['7', 'TTTTTT'],
  ['8', 'CAGCAG'],
  ['9', 'AAAAAAAAAA'],
  ['10', 'CGCG'],
  ['11', 'TTAA'],
]
const WALKS = `W\tGRCh38\t0\tchrA\t0\t59\t>1>2>4>5>6>7>8>9>8>10
W\tHG01109\t1\tctgA\t0\t50\t>1>3>4>6>11>7>8>9
W\tHG01109\t1\tctgA\t50\t70\t>9>8>10
W\tHG01123\t1\tctgB\t0\t23\t>1<7<5>10
W\tHG00097\t1\tctgC\t0\t10\t>1
`
const PATHS = `P\tGRCh38#0#chrA\t1+,2+,4+,5+,6+,7+,8+,9+,8+,10+\t*
P\tHG01109#1#ctgA\t1+,3+,4+,6+,11+,7+,8+,9+,9+,8+,10+\t*
P\tHG01123#1#ctgB\t1+,7-,5-,10+\t*
P\tHG00097#1#ctgC\t1+\t*
`
const HEADER = `H\tVN:Z:1.1\n${NODES.map(([id, seq]) => `S\t${id}\t${seq}\n`).join('')}L\t1\t+\t2\t+\t0M\n`
const WITH_WALKS = HEADER + WALKS
const WITH_PATHS = HEADER + PATHS

// qname qlen qstart qend strand tname tlen tstart tend matches blocklen mapq cg
const CTGA_FIRST_PIECE = [
  'HG01109#1#ctgA',
  '70',
  '0',
  '50',
  '+',
  'GRCh38#0#chrA',
  '59',
  '0',
  '49',
  '45',
  '53',
  '255',
  'cg:Z:10=1X5=3D8=4I22=',
]
const CTGA_SECOND_PIECE = [
  'HG01109#1#ctgA',
  '70',
  '50',
  '70',
  '+',
  'GRCh38#0#chrA',
  '59',
  '39',
  '59',
  '20',
  '20',
  '255',
  'cg:Z:20=',
]
const CTGB_FORWARD = [
  'HG01123#1#ctgB',
  '23',
  '0',
  '10',
  '+',
  'GRCh38#0#chrA',
  '59',
  '0',
  '10',
  '10',
  '10',
  '255',
  'cg:Z:10=',
]
// 7 then 5 backwards: reference 16..33 with the 8 bp of node 6 deleted, and
// the CIGAR reads along the reference, so node 5 comes first
const CTGB_INVERTED = [
  'HG01123#1#ctgB',
  '23',
  '10',
  '19',
  '-',
  'GRCh38#0#chrA',
  '59',
  '16',
  '33',
  '9',
  '17',
  '255',
  'cg:Z:3=8D6=',
]
const CTGB_TAIL = [
  'HG01123#1#ctgB',
  '23',
  '19',
  '23',
  '+',
  'GRCh38#0#chrA',
  '59',
  '55',
  '59',
  '4',
  '4',
  '255',
  'cg:Z:4=',
]
const CTGC = [
  'HG00097#1#ctgC',
  '10',
  '0',
  '10',
  '+',
  'GRCh38#0#chrA',
  '59',
  '0',
  '10',
  '10',
  '10',
  '255',
  'cg:Z:10=',
]
const ALL_ROWS = [
  CTGC,
  CTGA_FIRST_PIECE,
  CTGA_SECOND_PIECE,
  CTGB_FORWARD,
  CTGB_INVERTED,
  CTGB_TAIL,
]

function convert(gfa: string, args: string[]) {
  const result = spawnSync(
    'python3',
    [path.join(__dirname, 'gfa_to_pairwise_paf.py'), ...args],
    { encoding: 'utf8', input: gfa },
  )
  if (result.error) {
    throw result.error
  }
  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function pafRows(stdout: string) {
  return tsvRows(stdout).sort(
    (a, b) => a[0]!.localeCompare(b[0]!) || Number(a[2]) - Number(b[2]),
  )
}

beforeAll(() => {
  assertPython3()
})

test('every row by hand: a SNP, an indel each way, an inversion, two W pieces, and a node the reference visits twice', () => {
  const run = convert(WITH_WALKS, ['--reference', 'GRCh38#0'])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual(ALL_ROWS)
  expect(run.stderr).toMatch(
    /HG01109#1: 2 walks, 9 anchors -> 2 chains, 65 bp =, 73 columns/,
  )
  expect(run.stderr).toMatch(/11 nodes, 10 GRCh38#0 steps on 1 walks/)
})

test('P lines give the same rows, and a bare --reference means haplotype 0', () => {
  const run = convert(WITH_PATHS, ['--reference', 'GRCh38'])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual(ALL_ROWS)
})

test('--max-gap breaks a chain at a private run longer than it', () => {
  const run = convert(WITH_WALKS, [
    '--reference',
    'GRCh38',
    '--queries',
    'HG01109#1,HG01123#1',
    '--max-gap',
    '2',
  ])
  expect(run.status).toBe(0)
  const identical = (
    q: string,
    qlen: string,
    qs: number,
    qe: number,
    strand: string,
    ts: string,
    te: string,
  ) => [
    q,
    qlen,
    String(qs),
    String(qe),
    strand,
    'GRCh38#0#chrA',
    '59',
    ts,
    te,
    String(qe - qs),
    String(qe - qs),
    '255',
    `cg:Z:${qe - qs}=`,
  ]
  expect(pafRows(run.stdout)).toEqual([
    [
      'HG01109#1#ctgA',
      '70',
      '0',
      '16',
      '+',
      'GRCh38#0#chrA',
      '59',
      '0',
      '16',
      '15',
      '16',
      '255',
      'cg:Z:10=1X5=',
    ],
    identical('HG01109#1#ctgA', '70', 16, 24, '+', '19', '27'),
    identical('HG01109#1#ctgA', '70', 28, 50, '+', '27', '49'),
    CTGA_SECOND_PIECE,
    CTGB_FORWARD,
    identical('HG01123#1#ctgB', '23', 10, 16, '-', '27', '33'),
    identical('HG01123#1#ctgB', '23', 16, 19, '-', '16', '19'),
    CTGB_TAIL,
  ])
})

test('--no-x writes the private runs as an insertion then a deletion', () => {
  const run = convert(WITH_WALKS, [
    '--reference',
    'GRCh38',
    '--queries',
    'HG01109#1',
    '--no-x',
  ])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual([
    [
      'HG01109#1#ctgA',
      '70',
      '0',
      '50',
      '+',
      'GRCh38#0#chrA',
      '59',
      '0',
      '49',
      '45',
      '54',
      '255',
      'cg:Z:10=1I1D5=3D8=4I22=',
    ],
    CTGA_SECOND_PIECE,
  ])
})

test('--min-block drops the short records and --queries the other haplotypes', () => {
  const run = convert(WITH_WALKS, [
    '--reference',
    'GRCh38',
    '--queries',
    'HG01123#1',
    '--min-block',
    '15',
  ])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual([CTGB_INVERTED])
})

test('chrom.sizes per query, from the largest W end unless --contig-lengths says otherwise', () => {
  const at = fixture({ 'lengths.txt': 'ctgA\t100\n' })
  const run = convert(WITH_WALKS, [
    '--reference',
    'GRCh38',
    '--chrom-sizes-dir',
    at('sizes'),
    '--contig-lengths',
    at('lengths.txt'),
  ])
  expect(run.status).toBe(0)
  expect(readFileSync(at('sizes/HG01109.1.chrom.sizes'), 'utf8')).toBe(
    'ctgA\t100\n',
  )
  expect(readFileSync(at('sizes/HG01123.1.chrom.sizes'), 'utf8')).toBe(
    'ctgB\t23\n',
  )
  expect(readFileSync(at('sizes/HG00097.1.chrom.sizes'), 'utf8')).toBe(
    'ctgC\t10\n',
  )
  expect(pafRows(run.stdout).filter(r => r[0] === 'HG01109#1#ctgA')).toEqual([
    CTGA_FIRST_PIECE.with(1, '100'),
    CTGA_SECOND_PIECE.with(1, '100'),
  ])
})

test('query walks ahead of the reference are held; one aligned before a late reference walk that shares its nodes is refused', () => {
  const walks = WALKS.split('\n').filter(l => l !== '')
  const queriesFirst =
    HEADER +
    [...walks.filter(l => !l.includes('GRCh38')), walks[0]!]
      .map(l => `${l}\n`)
      .join('')
  const held = convert(queriesFirst, ['--reference', 'GRCh38'])
  expect(held.status).toBe(0)
  expect(pafRows(held.stdout)).toEqual(ALL_ROWS)

  // minigraph-cactus writes one chromosome's S, L and W lines after another's,
  // so a second reference contig can follow the query walks; node 11 was
  // private to ctgA when it was aligned, which is what the guard catches
  const lateReference = `${WITH_WALKS}W\tGRCh38\t0\tchrB\t0\t4\t>11\n`
  const refused = convert(lateReference, ['--reference', 'GRCh38'])
  expect(refused.status).not.toBe(0)
  expect(refused.stderr).toMatch(
    /GRCh38#0 chrB:0 arrived after a query walk that visits 1 of its nodes/,
  )
  const heldAll = convert(lateReference, [
    '--reference',
    'GRCh38',
    '--hold-queries',
  ])
  expect(heldAll.status).toBe(0)
  expect(
    pafRows(heldAll.stdout).filter(r => r[0] === 'HG01109#1#ctgA'),
  ).toEqual([
    [
      'HG01109#1#ctgA',
      '70',
      '0',
      '24',
      '+',
      'GRCh38#0#chrA',
      '59',
      '0',
      '27',
      '23',
      '27',
      '255',
      'cg:Z:10=1X5=3D8=',
    ],
    [
      'HG01109#1#ctgA',
      '70',
      '24',
      '28',
      '+',
      'GRCh38#0#chrB',
      '4',
      '0',
      '4',
      '4',
      '4',
      '255',
      'cg:Z:4=',
    ],
    [
      'HG01109#1#ctgA',
      '70',
      '28',
      '50',
      '+',
      'GRCh38#0#chrA',
      '59',
      '27',
      '49',
      '22',
      '22',
      '255',
      'cg:Z:22=',
    ],
    CTGA_SECOND_PIECE,
  ])
})

test('a wrong --reference fails instead of writing nothing', () => {
  const run = convert(WITH_WALKS, ['--reference', 'CHM13'])
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/no CHM13#0 walk in the input/)
})
