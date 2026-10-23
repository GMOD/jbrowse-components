import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import {
  BAM,
  BIGBED,
  CRAM,
  DOG_VCF,
  GFF3,
  SIGNED_BIGWIG,
} from './volvox.fixture.ts'

const engine = createTablesEngine()

const elsewhere = <A extends { region: object }>(args: A) => ({
  ...args,
  region: { ...args.region, refName: 'chrNope' },
})

test('a region on a contig the file lacks reads empty and names the contigs it has', async () => {
  const reads = await engine.alignments(elsewhere(BAM))
  expect(reads.reads.start).toHaveLength(0)
  for (const t of [
    reads,
    await engine.alignments(elsewhere(CRAM)),
    await engine.features(elsewhere(GFF3)),
    await engine.features(elsewhere(BIGBED)),
    await engine.wiggle(elsewhere(SIGNED_BIGWIG)),
  ]) {
    expect(t.missingContig).toMatch(
      /^chrNope is not a contig of this file, whose contigs are .*ctgA/,
    )
  }
  expect((await engine.variants(elsewhere(DOG_VCF))).missingContig).toMatch(
    /whose contigs are .*chr30/,
  )
  expect((await engine.alignments(BAM)).missingContig).toBe('')
})

test('an alignments table reports the settings its bands are composed from', async () => {
  const t = await engine.alignments({
    ...BAM,
    display: {
      coverage: { show: false },
      sashimi: { height: 50 },
      pileup: { mark: { height: 3 } },
    },
  })
  expect(t.settings).toMatchObject({
    coverage: { show: false, height: 45 },
    pileup: { show: true, fadeLowFrequency: true, mark: { height: 3 } },
    sashimi: { height: 50, labels: { show: false } },
    readConnections: { show: false, mark: { type: 'link' } },
  })
})

test('a contig of the sequence holding no records of a tabix file is empty, not missing', async () => {
  const uri = (file: string) => ({
    uri: pathToFileURL(path.resolve('test_data/volvox', file)).href,
    locationType: 'UriLocation',
  })
  const onlyCtgA = {
    ...GFF3,
    adapterConfig: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: uri('volvox.canonical_tags.gff3.gz'),
      index: {
        location: uri('volvox.canonical_tags.gff3.gz.tbi'),
        indexType: 'TBI',
      },
    },
  }
  const emptyContig = await engine.features({
    ...onlyCtgA,
    region: { refName: 'ctgB', start: 0, end: 6000 },
  })
  expect(emptyContig.features.start).toHaveLength(0)
  expect(emptyContig.missingContig).toBe('')
  expect((await engine.features(elsewhere(onlyCtgA))).missingContig).toMatch(
    /^chrNope is not a contig of this file/,
  )
  const vcfOnlyCtgA = {
    adapterConfig: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: uri('volvox.filtered.vcf.gz'),
      index: { location: uri('volvox.filtered.vcf.gz.tbi') },
    },
    sequenceAdapter: GFF3.sequenceAdapter,
    region: { refName: 'ctgB', start: 0, end: 6000 },
  }
  expect((await engine.variants(vcfOnlyCtgA)).missingContig).toBe('')
  expect((await engine.variants(elsewhere(vcfOnlyCtgA))).missingContig).toMatch(
    /^chrNope is not a contig of this file/,
  )
})
