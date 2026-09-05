// maf_to_pairwise_paf.py is what build_hprc_multiway_synteny.sh runs over the
// HPRC graph's own alignment, and the two things it has to get right are the
// ones nothing downstream would catch: a `-` strand row's coordinates (a wrong
// conversion still indexes and draws, on the wrong bases) and where a chain
// breaks (a wrong break still yields valid PAF, just fragmented or fused). So
// the fixture is small enough to work every expected row out by hand.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { assertPython3, fixture, tsvRows } from './pythonHelperScript.ts'

// Four blocks tiling GRCh38.chr1:100-122. HG01109 is on + and continues
// exactly through all four, with two inserted bases in the second block, a
// mismatch in the third and a deleted base in the fourth. HG01123 is on -,
// chains through the first two blocks (a column both rows gap in the second is
// dropped), is absent from the third, and resumes exactly in the fourth with
// an N against the reference's A.
const DOTTED = `##maf version=1

a
s\tGRCh38.chr1\t100\t10\t+\t1000\tACGTACGTAC
s\tHG01109.1.ctgA\t50\t10\t+\t500\tACGTACGTAC
s\tHG01123.1.ctgB\t20\t10\t-\t300\tACGTACGTAC

a
s\tGRCh38.chr1\t110\t5\t+\t1000\tGGG--CC
s\tHG01109.1.ctgA\t60\t7\t+\t500\tGGGTTCC
s\tHG01123.1.ctgB\t30\t5\t-\t300\tGGG--Cc

a
s\tGRCh38.chr1\t115\t4\t+\t1000\tTTTT
s\tHG01109.1.ctgA\t67\t4\t+\t500\tTATT

a
s\tGRCh38.chr1\t119\t3\t+\t1000\tAAA
s\tHG01109.1.ctgA\t71\t2\t+\t500\tA-A
s\tHG01123.1.ctgB\t35\t3\t-\t300\tAAN

`

const PANSN = DOTTED.replaceAll('GRCh38.chr1', 'GRCh38#0#chr1')
  .replaceAll('HG01109.1.', 'HG01109#1#')
  .replaceAll('HG01123.1.', 'HG01123#1#')

// qname qlen qstart qend strand tname tlen tstart tend matches blocklen mapq cg
const HG01109_ALL_FOUR = [
  'HG01109#1#ctgA',
  '500',
  '50',
  '73',
  '+',
  'GRCh38#0#chr1',
  '1000',
  '100',
  '122',
  '20',
  '24',
  '255',
  'cg:Z:13=2I3=1X3=1D1=',
]
// strand coordinates 20..35 on a 300 bp contig, so forward 265..280
const HG01123_FIRST_TWO = [
  'HG01123#1#ctgB',
  '300',
  '265',
  '280',
  '-',
  'GRCh38#0#chr1',
  '1000',
  '100',
  '115',
  '15',
  '15',
  '255',
  'cg:Z:15=',
]
const HG01123_FOURTH = [
  'HG01123#1#ctgB',
  '300',
  '262',
  '265',
  '-',
  'GRCh38#0#chr1',
  '1000',
  '119',
  '122',
  '2',
  '3',
  '255',
  'cg:Z:2=1X',
]

function convert(maf: string, args: string[]) {
  const result = spawnSync(
    'python3',
    [path.join(__dirname, 'maf_to_pairwise_paf.py'), ...args],
    { encoding: 'utf8', input: maf },
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

// emission order follows when each chain becomes unreachable, which make-pif
// sorts away, so the rows are compared sorted by query then target start
function pafRows(stdout: string) {
  return tsvRows(stdout).sort(
    (a, b) => a[0]!.localeCompare(b[0]!) || Number(a[7]) - Number(b[7]),
  )
}

beforeAll(() => {
  assertPython3()
})

test('every row by hand: strands, indels, a mismatch, an N, and where the chains break', () => {
  const run = convert(DOTTED, ['--reference', 'GRCh38'])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual([
    HG01109_ALL_FOUR,
    HG01123_FIRST_TWO,
    HG01123_FOURTH,
  ])
  expect(run.stderr).toMatch(/7 query rows -> 3 PAF records, dotted names/)
})

test('--max-gap bridges the block a haplotype was absent from as a deletion', () => {
  const run = convert(DOTTED, ['--reference', 'GRCh38', '--max-gap', '10'])
  // 15= over blocks one and two, 4D for the third, 2=1X for the fourth;
  // 17 matches, 22 columns, forward query 262..280
  expect(pafRows(run.stdout)).toEqual([
    HG01109_ALL_FOUR,
    [
      'HG01123#1#ctgB',
      '300',
      '262',
      '280',
      '-',
      'GRCh38#0#chr1',
      '1000',
      '100',
      '122',
      '17',
      '22',
      '255',
      'cg:Z:15=4D2=1X',
    ],
  ])
})

test('PanSN-named rows give the same PAF, and either spelling names a query', () => {
  const run = convert(PANSN, [
    '--reference',
    'GRCh38',
    '--queries',
    'HG01109.1,HG01123#1',
  ])
  expect(run.status).toBe(0)
  expect(pafRows(run.stdout)).toEqual([
    HG01109_ALL_FOUR,
    HG01123_FIRST_TWO,
    HG01123_FOURTH,
  ])
  expect(run.stderr).toMatch(/PanSN names/)
})

test('--queries skips the other haplotypes and --min-block drops the short record', () => {
  const run = convert(DOTTED, [
    '--reference',
    'GRCh38',
    '--queries',
    'HG01123#1',
    '--min-block',
    '5',
  ])
  expect(pafRows(run.stdout)).toEqual([HG01123_FIRST_TWO])
  expect(run.stderr).toMatch(/3 query rows -> 1 PAF records/)
})

test('chrom.sizes per query lists each contig seen with its srcSize', () => {
  const at = fixture({})
  const run = convert(DOTTED, [
    '--reference',
    'GRCh38',
    '--chrom-sizes-dir',
    at('sizes'),
  ])
  expect(run.status).toBe(0)
  expect(readFileSync(at('sizes/HG01109.1.chrom.sizes'), 'utf8')).toBe(
    'ctgA\t500\n',
  )
  expect(readFileSync(at('sizes/HG01123.1.chrom.sizes'), 'utf8')).toBe(
    'ctgB\t300\n',
  )
})

test('a wrong --reference fails instead of writing nothing', () => {
  const run = convert(DOTTED, ['--reference', 'CHM13'])
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/has no CHM13#0 row/)
})
