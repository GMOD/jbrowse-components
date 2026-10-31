// What the variant display's site test costs as a compiled
// `filter` list (`compileSiteFilter`) against the two hand-written thresholds
// it replaced, a MAF floor of 0.01 and a missingness ceiling of 0.1. Two
// loops, arms interleaved, min over rounds:
//
// - the site test alone, over every record's precomputed allele summary
// - the whole per-record path (`getFilteredVariants`): allele counts, then
//   the test, which is what a fetch pays
//
//   node plugins/variants/benches/siteFilter.bench.ts
//   node plugins/variants/benches/siteFilter.bench.ts --rounds=15 --repeat=200
//
// Input is the 1000 Genomes slice in test_data: 1342 records x 2504 samples.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gunzipSync } from 'node:zlib'

import VcfParser from '@gmod/vcf'

import VcfFeature from '../src/VcfFeature/index.ts'
import { calculateAlleleCountsFast } from '../src/shared/alleleCounts.ts'
import {
  compileSiteFilter,
  getFilteredVariants,
  summarizeAlleleCounts,
} from '../src/shared/minorAlleleFrequencyUtils.ts'

import type { AlleleSummary } from '../src/shared/minorAlleleFrequencyUtils.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 9)
const repeat = arg('repeat', 100)

const root = join(import.meta.dirname, '..', '..', '..')
const VCF = join(
  root,
  'test_data/1000g_snpeff_chr1/ALL.chr1.phase3.155M.snpeff.vcf.gz',
)
const MIN_MAF = 0.01
const MAX_MISSINGNESS = 0.1
const SITE_FILTER: FieldPredicate[] = [
  { field: 'minorAlleleFrequency', gte: MIN_MAF },
  { field: 'missingness', lte: MAX_MISSINGNESS },
]

function loadFeatures() {
  const bytes = gunzipSync(readFileSync(VCF))
  const decoder = new TextDecoder()
  const header: string[] = []
  const records: string[] = []
  for (let start = 0; start < bytes.length;) {
    const nl = bytes.indexOf(10, start)
    const end = nl === -1 ? bytes.length : nl
    const line = decoder.decode(bytes.subarray(start, end))
    if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      records.push(line)
    }
    start = end + 1
  }
  const parser = new VcfParser({ header: header.join('\n') })
  return records.map(
    (l, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(l), id: `${i}` }),
  )
}

// the test `passesSiteThresholds` ran before the list
function handTest(summary: AlleleSummary) {
  return (
    summary.calledAlleleCount > 0 &&
    summary.minorAlleleFrequency >= MIN_MAF &&
    summary.missingness <= MAX_MISSINGNESS
  )
}
const compiledTest = compileSiteFilter(SITE_FILTER)

const features = loadFeatures()
const summaries = features.map(f =>
  summarizeAlleleCounts(calculateAlleleCountsFast(f)),
)

function testLoop(test: (s: AlleleSummary) => boolean) {
  let kept = 0
  for (let r = 0; r < repeat; r++) {
    for (const s of summaries) {
      if (test(s)) {
        kept++
      }
    }
  }
  return kept
}

function handPath() {
  let kept = 0
  for (const f of features) {
    if (handTest(summarizeAlleleCounts(calculateAlleleCountsFast(f)))) {
      kept++
    }
  }
  return kept
}

function compiledPath() {
  return getFilteredVariants({ features, siteFilter: SITE_FILTER }).length
}

const arms = {
  testHand: () => testLoop(handTest),
  testCompiled: () => testLoop(compiledTest),
  pathHand: handPath,
  pathCompiled: compiledPath,
}
const best: Record<string, number> = {}
const kept: Record<string, number> = {}
for (let r = 0; r < rounds; r++) {
  for (const [name, run] of Object.entries(arms)) {
    const t0 = performance.now()
    kept[name] = run()
    best[name] = Math.min(best[name] ?? Infinity, performance.now() - t0)
  }
}
if (
  kept.testHand !== kept.testCompiled ||
  kept.pathHand !== kept.pathCompiled
) {
  throw new Error(`kept differ: ${JSON.stringify(kept)}`)
}
const sites = summaries.length
console.log(
  `${sites} sites, ${kept.pathHand} kept; site test x${repeat}: hand ${best.testHand!.toFixed(2)} ms, compiled ${best.testCompiled!.toFixed(2)} ms (${((best.testCompiled! / (sites * repeat)) * 1e6).toFixed(1)} ns a site); whole path: hand ${best.pathHand!.toFixed(1)} ms, compiled ${best.pathCompiled!.toFixed(1)} ms`,
)
