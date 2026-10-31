// trgt-to-cnv-tr.mjs is downloaded and run by the HPRC repeats tutorial's
// readers, so the test runs the file itself and reads its output back through
// the parser the variant feature widget's tandem repeat card draws from.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { tandemRepeatOf } from '../plugins/variants/src/VariantFeatureWidget/TandemRepeatPanel/tandemRepeat.ts'

function convert(record: string) {
  const vcf = [
    '##fileformat=VCFv4.2',
    ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO'].join('\t'),
    record,
    '',
  ].join('\n')
  const result = spawnSync(
    'node',
    [path.join(__dirname, 'trgt-to-cnv-tr.mjs'), '-'],
    { input: vcf, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(
      `trgt-to-cnv-tr.mjs exited ${result.status}: ${result.stderr}`,
    )
  }
  const lines = result.stdout.split('\n').filter(l => l && !l.startsWith('#'))
  return { line: lines[0], stderr: result.stderr }
}

function convertedLine(record: string) {
  const { line } = convert(record)
  if (line === undefined) {
    throw new Error(`no record written for ${record}`)
  }
  return line
}

const allele = (a: number, b: number) =>
  `${'CAG'.repeat(a)}CAACAG${'CCG'.repeat(b)}`
const ref = `G${allele(10, 7)}`
const alt1 = `G${allele(17, 9)}`
const alt2 = `G${allele(24, 9)}`

function record(columns: string[]) {
  return [
    'chr4',
    '3074877',
    '.',
    ref,
    `${alt1},${alt2}`,
    '.',
    '.',
    'TRID=HTT;END=3074933;MOTIFS=CAG,CCG',
    ...columns,
  ].join('\t')
}

function feature(line: string) {
  const f = line.split('\t')
  const info = Object.fromEntries(
    f[7]!.split(';').map(kv => {
      const [key, value = ''] = kv.split('=')
      return [key, value.split(',')]
    }),
  )
  const keys = f[8]!.split(':')
  return {
    uniqueId: 'record',
    refName: f[0]!,
    start: Number(f[1]) - 1,
    end: Number(f[1]),
    name: f[2]!,
    ALT: f[4]!.split(','),
    INFO: info,
    samples: Object.fromEntries(
      f
        .slice(9)
        .map((s, i) => [
          `S${i + 1}`,
          Object.fromEntries(s.split(':').map((v, k) => [keys[k], [v]])),
        ]),
    ),
  }
}

test("a TRGT record's MS spans become the runs of each allele", () => {
  const line = convertedLine(
    record([
      'GT:AL:MC:MS',
      '1/2:84,105:17_9,24_9:0(0-51)_1(57-84),0(0-72)_1(78-105)',
      '0/1:57,84:10_7,17_9:0(0-30)_1(36-57),0(0-51)_1(57-84)',
    ]),
  )
  const f = line.split('\t')
  expect(f[3]).toBe('G')
  expect(f[4]).toBe('<CNV:TR>,<CNV:TR>')
  expect(f[7]).toContain('SVLEN=57,57;RN=2,2;RUS=CAG,CCG,CAG,CCG;RUL=3,3,3,3')
  expect(f[7]).toContain('RUC=17,9,24,9;RB=57,27,78,27')
  const repeat = tandemRepeatOf(feature(line))!
  expect(repeat.units.map(u => [u.sequence, u.copies])).toEqual([
    ['CAG', 41],
    ['CCG', 18],
  ])
  expect(repeat.alleles.map(a => [a.label, a.bp])).toEqual([
    ['S1 (1)', 84],
    ['S1 (2)', 105],
    ['S2 (1)', 57],
    ['S2 (2)', 84],
  ])
})

test('without MS, a locus of one motif states one run of it', () => {
  const single = (bp: number) => `G${'CCCCGTGAGC'.repeat(bp / 10)}`
  const line = convertedLine(
    [
      'chr19',
      '100',
      '.',
      single(100),
      `${single(250)},${single(40)}`,
      '.',
      '.',
      'TRID=VNTR;END=200;MOTIFS=CCCCGTGAGC',
      'GT:AL',
      '1/2:250,40',
    ].join('\t'),
  )
  const f = line.split('\t')
  expect(f[7]).toContain('RN=1,1;RUS=CCCCGTGAGC,CCCCGTGAGC')
  expect(f[7]).toContain('RUC=25,4;RB=250,40')
  expect(f[2]).toBe('VNTR')
})

test('a locus of several motifs with no MS is skipped', () => {
  const { line, stderr } = convert(record(['GT:AL', '1/2:84,105']))
  expect(line).toBeUndefined()
  expect(stderr).toContain(
    '1 records skipped: alleles state no runs (2 motifs, no MS)',
  )
})

// Records TRGT 5.1.0 wrote: the first from its example/ reads, the second from
// error-free reads of (CAG)17 CAACAG (CCG)9 and (CAG)24 CAACAG (CCG)9 over a
// (CAG)10 CAACAG (CCG)7 reference, merged with `trgt merge`. TRGT spans the CAG
// after CAACAG as a run of its own, and its MS leaves the CAA between spans.
const trgtExample = [
  `chrA\t10001\t.\tC${'CAG'.repeat(20)}\tC${'CAG'.repeat(11)}`,
  '.\t.\tTRID=TR1;END=10061;MOTIFS=CAG;STRUC=<TR>',
  'GT:AL:ALLR:SD:MC:MS:AP:AM',
  '1/1:33,33:30-39,33-33:15,14:11,11:0(0-33),0(0-33):1,1:.,.',
].join('\t')

const trgtMerged = [
  `chrB\t600\t.\tT${'CAG'.repeat(10)}CAACAG${'CCG'.repeat(7)}`,
  `T${allele(17, 9)},T${allele(24, 9)}`,
  '.\t.\tTRID=HTT;END=657;MOTIFS=CAG,CCG;STRUC=(CAG)n(CAACAG)(CCG)n',
  'GT:AL:ALLR:SD:MC:MS:AP:AM:PS',
  '1/2:84,105:84-84,105-105:20,20:18_9,25_9:0(0-51)_0(54-57)_1(57-84),0(0-72)_0(75-78)_1(78-105):0.988095,0.990476:.,.:.',
  '1/2:84,105:84-84,105-105:20,20:18_9,25_9:0(0-51)_0(54-57)_1(57-84),0(0-72)_0(75-78)_1(78-105):0.988095,0.990476:.,.:.',
].join('\t')

test("TRGT's own single-motif record states its copies and bases", () => {
  const f = convertedLine(trgtExample).split('\t')
  expect(f[7]).toContain('SVLEN=60;RN=1;RUS=CAG;RUL=3;RUC=11;RB=33')
})

test("a run's bases sum to the allele's AL, interruption included", () => {
  const line = convertedLine(trgtMerged)
  const info = line.split('\t')[7]!
  expect(info).toContain('RN=3,3;RUS=CAG,CAG,CCG,CAG,CAG,CCG')
  expect(info).toContain('RUC=17,1,9,24,1,9;RB=54,3,27,75,3,27')
  const repeat = tandemRepeatOf(feature(line))!
  expect(repeat.alleles.map(a => [a.label, a.bp])).toEqual([
    ['S1 (1)', 84],
    ['S1 (2)', 105],
    ['S2 (1)', 84],
    ['S2 (2)', 105],
  ])
})

test('a record with no ALT allele is skipped', () => {
  const { line, stderr } = convert(
    [
      'chr4',
      '10',
      '.',
      'GCAG',
      '.',
      '.',
      '.',
      'TRID=X;MOTIFS=CAG',
      'GT',
      '0/0',
    ].join('\t'),
  )
  expect(line).toBeUndefined()
  expect(stderr).toContain('1 records skipped: no ALT allele')
})
