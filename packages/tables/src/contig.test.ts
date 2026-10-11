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
    display: { showCoverage: false, minSashimiScore: 5 },
  })
  expect(t.settings).toMatchObject({
    showCoverage: false,
    showPileup: true,
    minSashimiScore: 5,
    fadeLowFrequencyMismatches: true,
  })
})
