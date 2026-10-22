import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import { BAM, CRAM, GFF3 } from './volvox.fixture.ts'

const engine = createTablesEngine()

const volvox = (file: string) => ({
  uri: pathToFileURL(path.resolve('test_data/volvox', file)).href,
  locationType: 'UriLocation',
})
const dir = mkdtempSync(path.join(tmpdir(), 'tables-assembly-'))
const aliasFile = path.join(dir, 'volvox.chromAlias.txt')
writeFileSync(aliasFile, '# ucsc\tother\nctgA\tA\tcontigA\nctgB\tB\tcontigB\n')

/** The volvox assembly as a config's `assemblies` entry writes it. */
const assembly = {
  name: 'volvox',
  uri: volvox('volvox.fa').uri,
  refNameAliases: { uri: pathToFileURL(aliasFile).href },
}
const ALTNAME_BAM = {
  ...BAM,
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: volvox('volvox-sorted-altname.bam'),
    index: {
      location: volvox('volvox-sorted-altname.bam.bai'),
      indexType: 'BAI',
    },
  },
}

test('an assembly reads a file under its own name for a contig and its alias', async () => {
  const { sequenceAdapter: _, ...unnamed } = ALTNAME_BAM
  const lost = await engine.alignments(unnamed)
  expect(lost.reads.start).toHaveLength(0)
  expect(lost.missingContig).toMatch(/^ctgA is not a contig of this file/)

  const asked = await engine.alignments({ ...unnamed, assembly })
  const same = await engine.alignments(BAM)
  expect(asked.missingContig).toBe('')
  expect(asked.readAs).toEqual({
    refName: ['contigA'],
    originalRefName: ['ctgA'],
  })
  expect(asked.reads.start).toEqual(same.reads.start)
  expect(asked.mismatches.position).toEqual(same.mismatches.position)

  const byAlias = await engine.alignments({
    ...BAM,
    region: { ...BAM.region, refName: 'A' },
    assembly,
  })
  expect(byAlias.readAs.refName).toEqual(['ctgA'])
  expect(byAlias.reads.start).toEqual(same.reads.start)
})

test('a host matches a contig name to the file’s through the assembly’s canonical names', async () => {
  const file = await engine.fileRegions({
    adapterConfig: ALTNAME_BAM.adapterConfig,
    assembly,
  })
  expect(file.refName).toEqual(['contigA'])
  expect(file.canonical).toEqual(['ctgA'])
  expect(
    (await engine.fileRegions({ adapterConfig: ALTNAME_BAM.adapterConfig }))
      .canonical,
  ).toEqual(['contigA'])
  expect(
    await engine.canonicalNames({
      assembly,
      refNames: ['A', 'contigA', 'CTGA', 'ctgB', 'chrNope'],
    }),
  ).toEqual({
    refName: ['A', 'contigA', 'CTGA', 'ctgB', 'chrNope'],
    canonical: ['ctgA', 'ctgA', 'ctgA', 'ctgB', 'chrNope'],
  })
})

test('canonicalNames takes one name as a scalar, never resolves a prototype member, and needs an assembly', async () => {
  expect(
    await engine.canonicalNames({ assembly, refNames: 'contigA' }),
  ).toEqual({ refName: ['contigA'], canonical: ['ctgA'] })
  const odd = ['constructor', 'toString', '__proto__', 'hasOwnProperty']
  expect(
    (await engine.canonicalNames({ assembly, refNames: odd })).canonical,
  ).toEqual(odd)
  await expect(engine.canonicalNames({ refNames: ['ctgA'] })).rejects.toThrow(
    /through an assembly/,
  )
})

test('a CRAM spelling its contig another way decodes against the assembly’s sequence', async () => {
  const { sequenceAdapter: _, ...cram } = CRAM
  const t = await engine.alignments({
    ...cram,
    adapterConfig: {
      type: 'CramAdapter',
      cramLocation: volvox('volvox-sorted-altname.cram'),
      craiLocation: volvox('volvox-sorted-altname.cram.crai'),
    },
    assembly,
  })
  expect(t.readAs.originalRefName).toEqual(['ctgA'])
  expect(t.reads.start).toEqual((await engine.alignments(CRAM)).reads.start)
})

test('features and the sequence read under an alias, and the regions list the sequence’s contigs', async () => {
  const genes = await engine.features({
    ...GFF3,
    region: { ...GFF3.region, refName: 'contigA' },
    assembly,
  })
  expect(genes.readAs.refName).toEqual(['ctgA'])
  expect(genes.features.name).toEqual(
    (await engine.features(GFF3)).features.name,
  )
  expect(genes.features.name.length).toBeGreaterThan(0)

  const region = { refName: 'contigB', start: 10, end: 30 }
  expect(await engine.sequence({ region, assembly })).toBe(
    await engine.sequence({
      region: { ...region, refName: 'ctgB' },
      sequenceAdapter: BAM.sequenceAdapter,
    }),
  )
  expect(await engine.regions({ assembly })).toEqual({
    refName: ['ctgA', 'ctgB'],
    canonical: ['ctgA', 'ctgB'],
    start: [0, 0],
    end: [50001, 6079],
  })
})

test('an assembly whose sequence is a chrom.sizes or a plain FASTA lists its contigs', async () => {
  const sequenceOf = (adapter: Record<string, unknown>) => ({
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox-refseq',
      adapter,
    },
  })
  const expected = {
    refName: ['ctgA', 'ctgB'],
    canonical: ['ctgA', 'ctgB'],
    start: [0, 0],
    end: [50001, 6079],
  }
  expect(
    await engine.regions({
      assembly: sequenceOf({
        type: 'ChromSizesAdapter',
        chromSizesLocation: volvox('volvox.chrom.sizes'),
      }),
    }),
  ).toEqual(expected)
  expect(
    await engine.regions({
      assembly: sequenceOf({
        type: 'UnindexedFastaAdapter',
        fastaLocation: volvox('volvox.fa'),
      }),
    }),
  ).toEqual(expected)
})

const CALLS_VCF = `##fileformat=VCFv4.3
##FILTER=<ID=PASS,Description="All filters passed">
##FILTER=<ID=Too_low_VAF,Description="Low VAF">
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##INFO=<ID=MATEID,Number=1,Type=String,Description="ID of mate breakend">
##FORMAT=<ID=DP,Number=1,Type=Float,Description="Tumor depth">
##FORMAT=<ID=AD,Number=1,Type=Float,Description="Tumor alt depth">
##FORMAT=<ID=NAD,Number=1,Type=Float,Description="Normal alt depth">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR
ctgA\t1100\tr_0_0\tA\tA[ctgB:200[\t.\tPASS\tSVTYPE=BND;MATEID=r_0_1\tDP:AD:NAD\t40:12:0
ctgA\t3000\td_1\tC\t<DEL>\t.\tToo_low_VAF\tSVTYPE=DEL;END=3400\tDP:AD:NAD\t35:2:0
`

test('a calls VCF with no GT reads as records with their FILTER, INFO and FORMAT, which the genotype matrix has no row for', async () => {
  const callsFile = path.join(dir, 'calls.vcf')
  writeFileSync(callsFile, CALLS_VCF)
  const adapterConfig = {
    type: 'VcfAdapter',
    vcfLocation: {
      uri: pathToFileURL(callsFile).href,
      locationType: 'UriLocation',
    },
  }
  const region = { refName: 'ctgA', start: 0, end: 50000 }
  const matrix = await engine.variants({ adapterConfig, region })
  expect(matrix.variants.start).toHaveLength(0)
  expect(matrix.rows.name).toHaveLength(0)

  const { features, vcf } = await engine.features({
    adapterConfig,
    region,
    bpPerPx: 50,
  })
  expect(features.name).toEqual(['r_0_0', 'd_1'])
  expect(vcf?.records).toEqual({
    ref: ['A', 'C'],
    alt: ['A[ctgB:200[', '<DEL>'],
    filter: ['PASS', 'Too_low_VAF'],
  })
  expect(vcf?.info.SVTYPE).toEqual(['BND', 'DEL'])
  expect(vcf?.info.MATEID).toEqual(['r_0_1', null])
  expect(vcf?.samples).toEqual({ feature: [0, 1], sample: ['TUMOR', 'TUMOR'] })
  expect(vcf?.format).toEqual({ DP: [40, 35], AD: [12, 2], NAD: [0, 0] })
  expect(vcf?.formatFields.type).toEqual(['Float', 'Float', 'Float'])
})

test('an assembly that fails to resolve is read again on the next call', async () => {
  await engine.clearCache()
  const missing = { name: 'nowhere', uri: volvox('nowhere.fa').uri }
  await expect(engine.regions({ assembly: missing })).rejects.toThrow()
  expect((await engine.cache()).assemblies).toBe(0)
  await engine.regions({ assembly })
  expect((await engine.cache()).assemblies).toBe(1)
})
