import VcfParser from '@gmod/vcf'

import VcfFeature from '../VcfFeature/index.ts'
import { makePhaseSetReader } from './phaseSetReader.ts'

import type { Feature } from '@jbrowse/core/util'

function vcfFeature(line: string, samples: string[]) {
  const parser = new VcfParser({
    header:
      '##fileformat=VCFv4.2\n' +
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="gt">\n' +
      '##FORMAT=<ID=DP,Number=1,Type=Integer,Description="dp">\n' +
      '##FORMAT=<ID=PS,Number=1,Type=Integer,Description="ps">\n' +
      `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}\n`,
  })
  return new VcfFeature({ variant: parser.parseLine(line), parser, id: 'f1' })
}

// What the reader hands the cell loops, per sample: the number when a phase set
// is present, `undefined` when it is not — which is exactly the argument
// `getPhasedColor` takes, and the shape `samples`-based reading used to produce.
function read(feature: Feature, sampleNames: string[]) {
  const reader = makePhaseSetReader(sampleNames)
  const ok = reader.read(feature)
  return {
    ok,
    values: sampleNames.map((_, i) =>
      reader.present[i] ? reader.value[i] : undefined,
    ),
  }
}

test('reads a phase set per sample as a number', () => {
  expect(
    read(
      vcfFeature(
        '1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77\t0|1:4815162342',
        ['S1', 'S2'],
      ),
      ['S1', 'S2'],
    ),
  ).toEqual({ ok: true, values: [77, 4815162342] })
})

test('finds PS wherever FORMAT puts it', () => {
  expect(
    read(
      vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:DP:PS\t1|0:30:77', ['S1']),
      ['S1'],
    ).values,
  ).toEqual([77])
})

// The three spellings of "this sample has no phase set here". All three have to
// come back undefined, because `getPhasedColor` reads undefined as "colour this
// cell by its allele instead" — the fallback the `samples` path got for free by
// parsing '.' to undefined.
test('an absent, empty, or dot PS is no phase set, not phase set zero', () => {
  // sample 2 has no PS column at all, sample 3 spells it '.'
  const feature = vcfFeature(
    '1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77\t1|0\t1|0:.',
    ['S1', 'S2', 'S3'],
  )
  expect(read(feature, ['S1', 'S2', 'S3']).values).toEqual([
    77,
    undefined,
    undefined,
  ])
})

// A FORMAT that declares no PS at all: every sample falls back to allele
// coloring rather than the reader inventing values.
test('a record with no PS in FORMAT reports none', () => {
  expect(
    read(vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:DP\t1|0:30', ['S1']), [
      'S1',
    ]).values,
  ).toEqual([undefined])
})

// `SAMPLES()` coerced a Type=Integer field with `+`, so a malformed id arrived
// as NaN and `getPhasedColor` painted hue 0. That is distinct from absent, and
// the range parse has to keep the distinction.
test('a malformed PS is present-but-NaN, not absent', () => {
  const { values } = read(
    vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:abc\t1|0:12x', [
      'S1',
      'S2',
    ]),
    ['S1', 'S2'],
  )
  expect(values.map(v => v !== undefined && Number.isNaN(v))).toEqual([
    true,
    true,
  ])
})

test('a negative phase-set id round-trips', () => {
  expect(
    read(vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:-5', ['S1']), [
      'S1',
    ]).values,
  ).toEqual([-5])
})

// A non-VCF adapter can't report FORMAT ranges. The reader says so rather than
// throwing, and the cell loops then paint by allele — the same outcome an
// absent `samples` field used to produce.
test('a feature that cannot report FORMAT ranges answers false', () => {
  const plain = {
    id: () => 'f1',
    get: (k: string) => (k === 'FORMAT' ? 'GT:PS' : undefined),
    toJSON: () => ({}),
  } as unknown as Feature
  expect(read(plain, ['S1']).ok).toBe(false)
})

// Stale values from a previous feature would paint last site's hues onto this
// one's cells, which is the sort of thing that only shows up on a second site.
test('a sample without PS at this site does not inherit the previous site', () => {
  const reader = makePhaseSetReader(['S1'])
  reader.read(vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77', ['S1']))
  expect(reader.present[0]).toBe(1)
  reader.read(vcfFeature('1\t201\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:.', ['S1']))
  expect(reader.present[0]).toBe(0)
})

// `processFormatFields` numbers samples against the header of the file THIS
// feature came from, exactly as `processGenotypes` does — so this reader needs
// the same translation `computeSampleInfo` does, and for the same reason.
// SplitVcfTabixAdapter opens one file per refName, so a view spanning two
// contigs whose headers disagree hands both to one reader. Without the remap
// every phase set after the first difference lands on a neighbouring sample:
// the cells stay coloured, and each one is coloured by somebody else's phase
// block.
//
// This is the fixture shape the genotype pass shipped a bug for want of, so it
// is written here for the code that repeats the pattern rather than left for
// the next person to rediscover.
test('phase sets follow the sample when a later header orders them differently', () => {
  // canonical order is the union in first-seen order: contig 1's header, then
  // the sample contig 2 adds
  const sampleNames = ['S1', 'S2', 'S0']
  const reader = makePhaseSetReader(sampleNames)

  reader.read(
    vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:11\t1|0:22', [
      'S1',
      'S2',
    ]),
  )
  expect([...reader.value.slice(0, 2)]).toEqual([11, 22])

  // contig 2's header puts S0 first, so header position 0/1/2 is canonical
  // column 2/0/1. Indexing the union by sampleIdx would read 33/44/55 in place.
  reader.read(
    vcfFeature('2\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:33\t1|0:44\t1|0:55', [
      'S0',
      'S1',
      'S2',
    ]),
  )
  expect({
    S1: reader.value[0],
    S2: reader.value[1],
    S0: reader.value[2],
  }).toEqual({ S1: 44, S2: 55, S0: 33 })
})

// A sample one file has and the canonical order does not know about is dropped
// rather than written out of bounds or onto column 0.
test('a header sample absent from the canonical order is skipped', () => {
  const reader = makePhaseSetReader(['S1'])
  reader.read(
    vcfFeature('1\t101\t.\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:11\t1|0:99', [
      'S1',
      'SX',
    ]),
  )
  expect([...reader.present]).toEqual([1])
  expect(reader.value[0]).toBe(11)
})
