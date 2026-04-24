/**
 * Benchmark: allele counting for MAF calculation
 * Simulates realistic load: many variants × many samples (diploid genotypes)
 *
 * Run with:
 *   node --experimental-strip-types plugins/variants/scripts/benchAlleleCounting.ts
 */

const GENOTYPE_SPLITTER = /[/|]/

// ─── Old implementation (inline if/else everywhere) ────────────────────────

function countAllelesOld(genotypes: Record<string, string>) {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts: Record<string, number> = {}

  for (const key in genotypes) {
    const genotype = genotypes[key]!
    const len = genotype.length

    if (len === 3) {
      const sep = genotype[1]
      if (sep === '/' || sep === '|') {
        const a0 = genotype[0]!
        const a1 = genotype[2]!
        if (a0 === '0') { count0++ } else if (a0 === '1') { count1++ } else if (a0 === '2') { count2++ } else if (a0 === '3') { count3++ } else if (a0 === '.') { countDot++ } else { otherCounts[a0] = (otherCounts[a0] || 0) + 1 }
        if (a1 === '0') { count0++ } else if (a1 === '1') { count1++ } else if (a1 === '2') { count2++ } else if (a1 === '3') { count3++ } else if (a1 === '.') { countDot++ } else { otherCounts[a1] = (otherCounts[a1] || 0) + 1 }
        continue
      }
    }

    if (len === 1) {
      if (genotype === '0') { count0++ } else if (genotype === '1') { count1++ } else if (genotype === '2') { count2++ } else if (genotype === '3') { count3++ } else if (genotype === '.') { countDot++ } else { otherCounts[genotype] = (otherCounts[genotype] || 0) + 1 }
      continue
    }

    const alleles = genotype.split(GENOTYPE_SPLITTER)
    for (const allele of alleles) {
      if (allele === '0') { count0++ } else if (allele === '1') { count1++ } else if (allele === '2') { count2++ } else if (allele === '3') { count3++ } else if (allele === '.') { countDot++ } else { otherCounts[allele] = (otherCounts[allele] || 0) + 1 }
    }
  }

  return { count0, count1, count2, count3, countDot }
}

// ─── New implementation (shared countStringAllele helper) ──────────────────

interface AlleleBuckets {
  count0: number
  count1: number
  count2: number
  count3: number
  countDot: number
  otherCounts: Record<string, number>
}

function countStringAllele(allele: string, b: AlleleBuckets) {
  if (allele === '0') { b.count0++ }
  else if (allele === '1') { b.count1++ }
  else if (allele === '2') { b.count2++ }
  else if (allele === '3') { b.count3++ }
  else if (allele === '.') { b.countDot++ }
  else { b.otherCounts[allele] = (b.otherCounts[allele] || 0) + 1 }
}

// New: local vars for hot paths, countStringAllele only in general (polyploid) case
function countAllelesNew(genotypes: Record<string, string>) {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts: Record<string, number> = {}

  for (const key in genotypes) {
    const genotype = genotypes[key]!
    const len = genotype.length

    if (len === 3) {
      const sep = genotype[1]
      if (sep === '/' || sep === '|') {
        const a0 = genotype[0]!
        const a1 = genotype[2]!
        if (a0 === '0') { count0++ } else if (a0 === '1') { count1++ } else if (a0 === '2') { count2++ } else if (a0 === '3') { count3++ } else if (a0 === '.') { countDot++ } else { otherCounts[a0] = (otherCounts[a0] || 0) + 1 }
        if (a1 === '0') { count0++ } else if (a1 === '1') { count1++ } else if (a1 === '2') { count2++ } else if (a1 === '3') { count3++ } else if (a1 === '.') { countDot++ } else { otherCounts[a1] = (otherCounts[a1] || 0) + 1 }
        continue
      }
    }

    if (len === 1) {
      if (genotype === '0') { count0++ } else if (genotype === '1') { count1++ } else if (genotype === '2') { count2++ } else if (genotype === '3') { count3++ } else if (genotype === '.') { countDot++ } else { otherCounts[genotype] = (otherCounts[genotype] || 0) + 1 }
      continue
    }

    for (const allele of genotype.split(GENOTYPE_SPLITTER)) {
      if (allele === '0') { count0++ } else if (allele === '1') { count1++ } else if (allele === '2') { count2++ } else if (allele === '3') { count3++ } else if (allele === '.') { countDot++ } else { otherCounts[allele] = (otherCounts[allele] || 0) + 1 }
    }
  }

  return { count0, count1, count2, count3, countDot }
}

// ─── calculateAlleleCountsFast variants ───────────────────────────────────
// Simulate processGenotypes callback: iterate over sample genotype strings

const SLASH_CODE = 47
const PIPE_CODE = 124

// Current: AlleleBuckets object (b.count0++ inside callback)
function countFastBucket(samples: string[]) {
  const b: AlleleBuckets = { count0: 0, count1: 0, count2: 0, count3: 0, countDot: 0, otherCounts: {} }
  for (const genotype of samples) {
    const start = 0
    const end = genotype.length
    const len = end - start
    if (len === 3) {
      const sep = genotype.charCodeAt(start + 1)
      if (sep === SLASH_CODE || sep === PIPE_CODE) {
        const c0 = genotype.charCodeAt(start)
        const c1 = genotype.charCodeAt(start + 2)
        if (c0 === 48) { b.count0++ } else if (c0 === 49) { b.count1++ } else if (c0 === 50) { b.count2++ } else if (c0 === 51) { b.count3++ } else if (c0 === 46) { b.countDot++ }
        if (c1 === 48) { b.count0++ } else if (c1 === 49) { b.count1++ } else if (c1 === 50) { b.count2++ } else if (c1 === 51) { b.count3++ } else if (c1 === 46) { b.countDot++ }
        continue
      }
    }
    if (len === 1) {
      const c = genotype.charCodeAt(start)
      if (c === 48) { b.count0++ } else if (c === 49) { b.count1++ } else if (c === 50) { b.count2++ } else if (c === 51) { b.count3++ } else if (c === 46) { b.countDot++ }
    }
  }
  return b
}

// Alternative: local variables captured by callback (avoids object property access)
function countFastLocals(samples: string[]) {
  let count0 = 0, count1 = 0, count2 = 0, count3 = 0, countDot = 0
  for (const genotype of samples) {
    const start = 0
    const end = genotype.length
    const len = end - start
    if (len === 3) {
      const sep = genotype.charCodeAt(start + 1)
      if (sep === SLASH_CODE || sep === PIPE_CODE) {
        const c0 = genotype.charCodeAt(start)
        const c1 = genotype.charCodeAt(start + 2)
        if (c0 === 48) { count0++ } else if (c0 === 49) { count1++ } else if (c0 === 50) { count2++ } else if (c0 === 51) { count3++ } else if (c0 === 46) { countDot++ }
        if (c1 === 48) { count0++ } else if (c1 === 49) { count1++ } else if (c1 === 50) { count2++ } else if (c1 === 51) { count3++ } else if (c1 === 46) { countDot++ }
        continue
      }
    }
    if (len === 1) {
      const c = genotype.charCodeAt(start)
      if (c === 48) { count0++ } else if (c === 49) { count1++ } else if (c === 50) { count2++ } else if (c === 51) { count3++ } else if (c === 46) { countDot++ }
    }
  }
  return { count0, count1, count2, count3, countDot }
}

// ─── Dataset generation ────────────────────────────────────────────────────

// Realistic diploid mix: mostly 0/0, 0/1, 1/1, small fraction ./. and polyploid
const DIPLOID_POOL = [
  '0/0', '0/0', '0/0', '0/0', '0/0', '0/0',  // 60% ref/ref
  '0/1', '0/1', '0/1',                          // 30% het
  '1/1',                                         // ~7% hom alt
  './.',                                          // ~3% no-call
]
const POLYPLOID_POOL = ['0/0/1', '0/1/1', '1/1/1', '0/0/0/1']

function makeGenotypes(nSamples: number, polyploidFraction = 0): Record<string, string> {
  const gt: Record<string, string> = {}
  const nPolyploid = Math.floor(nSamples * polyploidFraction)
  for (let i = 0; i < nSamples; i++) {
    if (i < nPolyploid) {
      gt[`s${i}`] = POLYPLOID_POOL[i % POLYPLOID_POOL.length]!
    } else {
      gt[`s${i}`] = DIPLOID_POOL[i % DIPLOID_POOL.length]!
    }
  }
  return gt
}

// ─── Benchmark harness ─────────────────────────────────────────────────────

function bench(label: string, fn: () => void, warmupRuns = 3, measuredRuns = 10) {
  for (let i = 0; i < warmupRuns; i++) { fn() }
  const times: number[] = []
  for (let i = 0; i < measuredRuns; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  console.log(`${label.padEnd(52)} mean=${mean.toFixed(1).padStart(7)}ms  min=${min.toFixed(1).padStart(7)}ms  max=${max.toFixed(1).padStart(7)}ms`)
}

// ─── Run ───────────────────────────────────────────────────────────────────

const VARIANTS = 2_000
const SAMPLES_SMALL = 1_000   // 2M genotypes
const SAMPLES_LARGE = 10_000  // 20M genotypes

console.log(`\nAllele counting benchmark`)
console.log(`Variants: ${VARIANTS.toLocaleString()}`)

console.log(`\n== calculateAlleleCounts (string genotypes, non-VCF fallback path) ==`)
for (const [label, nSamples, polyFrac] of [
  ['diploid only', SAMPLES_SMALL, 0],
  ['diploid + 5% polyploid', SAMPLES_SMALL, 0.05],
  ['large diploid', SAMPLES_LARGE, 0],
] as [string, number, number][]) {
  const variants = Array.from({ length: VARIANTS }, () => makeGenotypes(nSamples, polyFrac))
  const totalGenotypes = VARIANTS * nSamples
  console.log(`\n  ${label} (${nSamples.toLocaleString()} samples, ${totalGenotypes.toLocaleString()} genotypes total)`)
  bench('  old (inline if/else)', () => { for (const gt of variants) { countAllelesOld(gt) } })
  bench('  new (inline, local vars)', () => { for (const gt of variants) { countAllelesNew(gt) } })
}

console.log(`\n== calculateAlleleCountsFast (charCode hot path) — bucket obj vs local vars ==`)
{
  const samples = Array.from({ length: SAMPLES_LARGE }, (_, i) => DIPLOID_POOL[i % DIPLOID_POOL.length]!)
  const totalGenotypes = VARIANTS * SAMPLES_LARGE
  console.log(`\n  large diploid (${SAMPLES_LARGE.toLocaleString()} samples, ${totalGenotypes.toLocaleString()} genotypes total)`)
  bench('  bucket object (b.count0++)', () => { for (let i = 0; i < VARIANTS; i++) { countFastBucket(samples) } })
  bench('  local vars (count0++)', () => { for (let i = 0; i < VARIANTS; i++) { countFastLocals(samples) } })
}

console.log('')
