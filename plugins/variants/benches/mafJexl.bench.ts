// What does a VCF track's `maf(feature) < 0.01 && missingness(feature) < 0.1`
// filter cost per sample, through jexl as the filter chain compiles it?
//
//   node --expose-gc plugins/variants/benches/mafJexl.bench.ts
//   node --expose-gc plugins/variants/benches/mafJexl.bench.ts --base=HEAD~1 --rounds=15
//
// Three arms, interleaved round-robin, min across rounds, identity checked
// first (agent-docs/reference/BENCHMARKING.md): the base ref's registration,
// the same ref extracted a second time as the control, and the working tree's.
// A ref from before `featureMinorAlleleFrequency` existed registered the
// genotypes-Record path inline in index.ts, which node cannot import; its arm
// rebuilds that closure from the ref's own modules.
//
// Input is the 1000 Genomes slice in test_data: 1342 records x 2504 samples,
// FORMAT GT, parsed once up front as the adapter would. `&&` short-circuits,
// so missingness runs only on the records maf lets through; the output says
// how many.
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gunzipSync } from 'node:zlib'

import VcfParser from '@gmod/vcf'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { checkoutPackageAtRef } from '../../maf/benches/refCheckout.ts'
import VcfFeature from '../src/VcfFeature/index.ts'
import {
  featureMinorAlleleFrequency,
  featureMissingness,
} from '../src/shared/minorAlleleFrequencyUtils.ts'

import type { Feature } from '@jbrowse/core/util'

const root = join(import.meta.dirname, '..', '..', '..')
const FILTER = 'jexl:maf(feature) < 0.01 && missingness(feature) < 0.1'
const VCF = join(
  root,
  'test_data/1000g_snpeff_chr1/ALL.chr1.phase3.155M.snpeff.vcf.gz',
)

type FeatureFn = (feature: Feature) => number

interface Registration {
  maf: FeatureFn
  missingness: FeatureFn
}

function hasFn<K extends string>(
  mod: object,
  key: K,
): mod is Record<K, (...args: never[]) => unknown> {
  return key in mod && typeof (mod as Record<K, unknown>)[key] === 'function'
}

async function loadRef(ref: string) {
  const dir = checkoutPackageAtRef(root, ref, 'plugins/variants')
  const shared = join(dir, 'plugins/variants/src/shared')
  const utils: object = await import(
    join(shared, 'minorAlleleFrequencyUtils.ts')
  )
  const counts: object = await import(join(shared, 'alleleCounts.ts'))
  if (
    hasFn(utils, 'featureMinorAlleleFrequency') &&
    hasFn(utils, 'featureMissingness')
  ) {
    return {
      dir,
      fns: {
        maf: utils.featureMinorAlleleFrequency as FeatureFn,
        missingness: utils.featureMissingness as FeatureFn,
      },
    }
  }
  if (
    !hasFn(counts, 'calculateAlleleCounts') ||
    !hasFn(utils, 'calculateMinorAlleleFrequency') ||
    !hasFn(utils, 'calculateMissingnessFrequency')
  ) {
    throw new Error(`${ref} has neither registration`)
  }
  const calculateAlleleCounts = counts.calculateAlleleCounts as (
    g: Record<string, string>,
  ) => Record<string, number>
  const toMaf = utils.calculateMinorAlleleFrequency as (
    c: Record<string, number>,
  ) => number
  const toMissingness = utils.calculateMissingnessFrequency as (
    c: Record<string, number>,
  ) => number
  const featureAlleleCounts = (feature: Feature) => {
    const genotypes = feature.get('genotypes') as
      | Record<string, string>
      | undefined
    return genotypes ? calculateAlleleCounts(genotypes) : undefined
  }
  return {
    dir,
    fns: {
      maf: (feature: Feature) => {
        const c = featureAlleleCounts(feature)
        return c ? toMaf(c) : 0
      },
      missingness: (feature: Feature) => {
        const c = featureAlleleCounts(feature)
        return c ? toMissingness(c) : 0
      },
    },
  }
}

function makeChain({ maf, missingness }: Registration) {
  const jexl = createJexlInstance()
  jexl.addFunction('maf', maf)
  jexl.addFunction('missingness', missingness)
  return new SerializableFilterChain({ filters: [FILTER], jexl })
}

// One decode per line, as @gmod/tabix hands them over. `split('\n')` on the
// whole file instead makes each line a V8 SlicedString, which the genotype scan
// pays an unwrap for on every charCodeAt: 1.4x on this file.
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
  const features = records.map(
    (l, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(l), id: `${i}` }),
  )
  return { features, samples: parser.samples.length }
}

// Three drivers written out longhand on purpose: one shared driver would put
// all three chains through a single call site and time its megamorphism.
function runBase(chain: SerializableFilterChain, features: Feature[]) {
  let kept = 0
  for (const f of features) {
    if (chain.passes(f)) {
      kept++
    }
  }
  return kept
}

function runControl(chain: SerializableFilterChain, features: Feature[]) {
  let kept = 0
  for (const f of features) {
    if (chain.passes(f)) {
      kept++
    }
  }
  return kept
}

function runHead(chain: SerializableFilterChain, features: Feature[]) {
  let kept = 0
  for (const f of features) {
    if (chain.passes(f)) {
      kept++
    }
  }
  return kept
}

const baseRef =
  process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length) ??
  'main'
const rounds = Number(
  process.argv
    .find(a => a.startsWith('--rounds='))
    ?.slice('--rounds='.length) ?? 10,
)

const { features, samples } = loadFeatures()
const base = await loadRef(baseRef)
const control = await loadRef(baseRef)
const head: Registration = {
  maf: featureMinorAlleleFrequency,
  missingness: featureMissingness,
}

try {
  let differ = 0
  let rare = 0
  for (const f of features) {
    const values = [base.fns, control.fns, head].map(r => [
      r.maf(f),
      r.missingness(f),
    ])
    const [m, miss] = values[2]!
    if (values.some(([a, b]) => !Object.is(a, m) || !Object.is(b, miss))) {
      differ++
    }
    if (m! < 0.01) {
      rare++
    }
  }

  const baseChain = makeChain(base.fns)
  const controlChain = makeChain(control.fns)
  const headChain = makeChain(head)
  const kept = [
    runBase(baseChain, features),
    runControl(controlChain, features),
    runHead(headChain, features),
  ]

  const best = { base: Infinity, control: Infinity, head: Infinity }
  for (let round = 0; round < rounds; round++) {
    globalThis.gc?.()
    let t0 = performance.now()
    runBase(baseChain, features)
    best.base = Math.min(best.base, performance.now() - t0)

    globalThis.gc?.()
    t0 = performance.now()
    runControl(controlChain, features)
    best.control = Math.min(best.control, performance.now() - t0)

    globalThis.gc?.()
    t0 = performance.now()
    runHead(headChain, features)
    best.head = Math.min(best.head, performance.now() - t0)
  }

  const cells = features.length * samples
  const ns = (ms: number) => ((ms * 1e6) / cells).toFixed(1).padStart(7)
  const ms = (v: number) => v.toFixed(1).padStart(8)
  console.log(
    `${FILTER}\n` +
      `${features.length} records x ${samples} samples; maf < 0.01 on ${rare}, ` +
      `so missingness ran on those; kept ${kept.join(' / ')}\n` +
      `values ${differ ? `DIFFER on ${differ} records` : 'identical on every record'}\n` +
      `min of ${rounds} interleaved rounds\n` +
      `  ${'arm'.padEnd(14)} ${'ms'.padStart(8)} ${'ns/sample'.padStart(10)}  vs base\n` +
      `  ${baseRef.padEnd(14)} ${ms(best.base)} ${ns(best.base)}\n` +
      `  ${'control'.padEnd(14)} ${ms(best.control)} ${ns(best.control)}     ${(best.base / best.control).toFixed(2)}x\n` +
      `  ${'working tree'.padEnd(14)} ${ms(best.head)} ${ns(best.head)}     ${(best.base / best.head).toFixed(2)}x`,
  )
  if (differ || new Set(kept).size !== 1) {
    process.exitCode = 1
  }
} finally {
  rmSync(base.dir, { recursive: true, force: true })
  rmSync(control.dir, { recursive: true, force: true })
}
