import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import {
  BAM,
  CRAM,
  DOG_VCF,
  GFF3,
  MULTI_BIGWIG,
  OVERLAP,
  SIGNED_BIGWIG,
} from './volvox.fixture.ts'

const engine = createTablesEngine()

const volvox = (file: string) => ({
  uri: pathToFileURL(path.resolve('test_data/volvox', file)).href,
  locationType: 'UriLocation',
})
const FAI_LENGTH = new Map(
  readFileSync('test_data/volvox/volvox.fa.fai', 'utf8')
    .trim()
    .split('\n')
    .map(line => line.split('\t'))
    .map(([name, length]) => [name!, Number(length)]),
)
const UNKNOWN_END = 2 ** 31 - 1

test('a BAM’s contigs end at its @SQ lengths, which are the reference’s', async () => {
  const t = await engine.fileRegions({ adapterConfig: BAM.adapterConfig })
  expect(t.refName).toEqual(['ctgA'])
  expect(t.start).toEqual([0])
  expect(t.end).toEqual([FAI_LENGTH.get('ctgA')])
  expect(t.lengthKnown).toEqual([true])
  expect(t.hasData).toEqual([true])
})

test('a BAM keeps a contig its @SQ lists and holds no reads on, which its index cannot call empty', async () => {
  const t = await engine.fileRegions({ adapterConfig: OVERLAP.adapterConfig })
  expect(t.refName).toEqual(['ctgA', 'ctgB'])
  expect(t.end).toEqual(['ctgA', 'ctgB'].map(n => FAI_LENGTH.get(n)))
  expect(t.hasData).toEqual([true, null])
})

test('a CRAM index says which contigs hold reads', async () => {
  expect(
    (await engine.fileRegions({ adapterConfig: CRAM.adapterConfig })).hasData,
  ).toEqual([true])
  const t = await engine.fileRegions({
    adapterConfig: {
      type: 'CramAdapter',
      cramLocation: volvox('volvox-rg.cram'),
      craiLocation: volvox('volvox-rg.cram.crai'),
    },
  })
  expect(t.refName).toEqual(['ctgA', 'ctgB'])
  expect(t.end).toEqual(['ctgA', 'ctgB'].map(n => FAI_LENGTH.get(n)))
  expect(t.hasData).toEqual([true, false])
})

test('a VCF’s contigs take their ##contig lengths, and a name its index lists holds records', async () => {
  const plain = await engine.fileRegions({
    adapterConfig: {
      type: 'VcfAdapter',
      vcfLocation: volvox('volvox.del.vcf'),
    },
  })
  expect(plain).toEqual({
    refName: ['ctgA'],
    start: [0],
    end: [50001],
    lengthKnown: [true],
    hasData: [true],
  })
  const tabix = await engine.fileRegions({
    adapterConfig: DOG_VCF.adapterConfig,
  })
  expect(tabix.refName).toEqual(['chr30'])
  expect(tabix.lengthKnown).toEqual([true])
  expect(tabix.end[0]).toBeGreaterThan(38265000)
  expect(tabix.hasData).toEqual([true])
})

test('a BigWig’s contigs take its chrom table’s lengths, holding data or not', async () => {
  const t = await engine.fileRegions({
    adapterConfig: SIGNED_BIGWIG.adapterConfig,
  })
  t.refName.forEach((name, i) => {
    expect(t.end[i]).toBe(FAI_LENGTH.get(name))
  })
  expect(t.lengthKnown.every(Boolean)).toBe(true)
  expect(t.hasData.every(h => h === null)).toBe(true)
})

test('a multi-wiggle’s contigs take its BigWigs’ chrom table lengths', async () => {
  const t = await engine.fileRegions({
    adapterConfig: MULTI_BIGWIG.adapterConfig,
  })
  expect(t.refName).toEqual(['ctgA', 'ctgB'])
  expect(t.end).toEqual(['ctgA', 'ctgB'].map(n => FAI_LENGTH.get(n)))
  expect(t.lengthKnown).toEqual([true, true])
  expect(t.hasData).toEqual([null, null])
})

test('a file stating no lengths reads to the int32 end, unless the assembly gives them', async () => {
  const bare = await engine.fileRegions({ adapterConfig: GFF3.adapterConfig })
  expect(bare.refName).toEqual(['ctgA', 'ctgB'])
  expect(bare.end).toEqual([UNKNOWN_END, UNKNOWN_END])
  expect(bare.lengthKnown).toEqual([false, false])
  expect(bare.hasData).toEqual([true, true])
  const named = await engine.fileRegions({
    adapterConfig: GFF3.adapterConfig,
    assembly: { name: 'volvox', uri: volvox('volvox.fa').uri },
  })
  expect(named.end).toEqual(['ctgA', 'ctgB'].map(n => FAI_LENGTH.get(n)))
  expect(named.lengthKnown).toEqual([true, true])
})
